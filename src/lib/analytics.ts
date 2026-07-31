import { prisma } from "@/lib/prisma";

/**
 * Admin analytics.
 *
 * Everything here is derived from existing timestamps — no counters to keep in
 * sync and nothing to backfill, so the numbers are always truthful even for
 * data created before analytics existed.
 */

export type PeriodKey = "week" | "month" | "quarter" | "year";

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  week: "This week",
  month: "This month",
  quarter: "This quarter",
  year: "This year",
};

/**
 * Start of the named period. These are *calendar* periods (week starts Monday,
 * quarter snaps to Jan/Apr/Jul/Oct) rather than rolling "last N days" windows,
 * because "how many signups this month" normally means the calendar month.
 */
export function periodStart(period: PeriodKey, now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);

  switch (period) {
    case "week": {
      // getDay(): 0=Sun..6=Sat. Shift so Monday is the first day.
      const dow = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - dow);
      return d;
    }
    case "month":
      d.setDate(1);
      return d;
    case "quarter":
      d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1);
      return d;
    case "year":
      d.setMonth(0, 1);
      return d;
  }
}

const PERIODS: PeriodKey[] = ["week", "month", "quarter", "year"];

/** New user registrations per calendar period. */
export async function getSignupCounts(
  now = new Date()
): Promise<Record<PeriodKey, number>> {
  const counts = await Promise.all(
    PERIODS.map((p) =>
      prisma.user.count({ where: { createdAt: { gte: periodStart(p, now) } } })
    )
  );
  return Object.fromEntries(PERIODS.map((p, i) => [p, counts[i]])) as Record<
    PeriodKey,
    number
  >;
}

/**
 * Distinct users who did something meaningful since `since`.
 *
 * "Something meaningful" is the union of: completing a unit, submitting a quiz
 * attempt, enrolling, posting, commenting, or sending a message. We union
 * distinct ids in JS rather than trying to express it as one SQL query — the
 * volumes here are small, and this keeps the definition readable and easy to
 * extend with new signals.
 */
export async function countActiveUsers(since: Date): Promise<number> {
  const [progress, attempts, enrollments, posts, comments, messages] =
    await Promise.all([
      prisma.unitProgress.findMany({
        where: { completedAt: { gte: since } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.attempt.findMany({
        where: { submittedAt: { gte: since } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.enrollment.findMany({
        where: { enrolledAt: { gte: since } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.post.findMany({
        where: { createdAt: { gte: since } },
        select: { authorId: true },
        distinct: ["authorId"],
      }),
      prisma.postComment.findMany({
        where: { createdAt: { gte: since } },
        select: { authorId: true },
        distinct: ["authorId"],
      }),
      prisma.message.findMany({
        where: { createdAt: { gte: since } },
        select: { senderId: true },
        distinct: ["senderId"],
      }),
    ]);

  const ids = new Set<string>();
  for (const r of progress) ids.add(r.userId);
  for (const r of attempts) ids.add(r.userId);
  for (const r of enrollments) ids.add(r.userId);
  for (const r of posts) ids.add(r.authorId);
  for (const r of comments) ids.add(r.authorId);
  for (const r of messages) ids.add(r.senderId);
  return ids.size;
}

/** Active learners per calendar period. */
export async function getActiveCounts(
  now = new Date()
): Promise<Record<PeriodKey, number>> {
  const counts = await Promise.all(
    PERIODS.map((p) => countActiveUsers(periodStart(p, now)))
  );
  return Object.fromEntries(PERIODS.map((p, i) => [p, counts[i]])) as Record<
    PeriodKey,
    number
  >;
}

export interface SeriesPoint {
  label: string;
  value: number;
}

/**
 * Signups bucketed by day for the last `days` days, oldest first. Fetches the
 * rows once and buckets in memory — cheaper and simpler than N count queries,
 * and gives us zero-filled gaps for free.
 */
export async function getSignupSeries(days = 30): Promise<SeriesPoint[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const rows = await prisma.user.findMany({
    where: { createdAt: { gte: start } },
    select: { createdAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    buckets.set(dayKey(d), 0);
  }
  for (const r of rows) {
    const k = dayKey(r.createdAt);
    if (buckets.has(k)) buckets.set(k, buckets.get(k)! + 1);
  }

  return [...buckets.entries()].map(([label, value]) => ({ label, value }));
}

/**
 * Signups bucketed by calendar month for the last `months` months, oldest
 * first. Labels are short month names for chart axes.
 */
export async function getSignupsByMonth(months = 12): Promise<SeriesPoint[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(1);
  start.setMonth(start.getMonth() - (months - 1));

  const rows = await prisma.user.findMany({
    where: { createdAt: { gte: start } },
    select: { createdAt: true },
  });

  const buckets = new Map<string, number>();
  const labels: string[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    const k = monthKey(d);
    buckets.set(k, 0);
    labels.push(k);
  }
  for (const r of rows) {
    const k = monthKey(r.createdAt);
    if (buckets.has(k)) buckets.set(k, buckets.get(k)! + 1);
  }

  return labels.map((k) => ({
    label: k.slice(5), // "2026-07" -> "07"
    value: buckets.get(k)!,
  }));
}

/** Unit completions bucketed by day, oldest first. */
export async function getCompletionSeries(days = 30): Promise<SeriesPoint[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const rows = await prisma.unitProgress.findMany({
    where: { completedAt: { gte: start } },
    select: { completedAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    buckets.set(dayKey(d), 0);
  }
  for (const r of rows) {
    if (!r.completedAt) continue;
    const k = dayKey(r.completedAt);
    if (buckets.has(k)) buckets.set(k, buckets.get(k)! + 1);
  }

  return [...buckets.entries()].map(([label, value]) => ({ label, value }));
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export interface CourseEngagement {
  id: string;
  title: string;
  enrollments: number;
  completions: number;
}

/** Per-course enrollment and completion totals, busiest first. */
export async function getCourseEngagement(
  limit = 8
): Promise<CourseEngagement[]> {
  const courses = await prisma.course.findMany({
    select: {
      id: true,
      title: true,
      _count: { select: { enrollments: true } },
      sections: {
        select: {
          units: {
            select: {
              _count: {
                select: { progress: { where: { status: "COMPLETE" } } },
              },
            },
          },
        },
      },
    },
  });

  return courses
    .map((c) => ({
      id: c.id,
      title: c.title,
      enrollments: c._count.enrollments,
      completions: c.sections.reduce(
        (sum, s) =>
          sum + s.units.reduce((us, u) => us + u._count.progress, 0),
        0
      ),
    }))
    .sort(
      (a, b) =>
        b.enrollments - a.enrollments || b.completions - a.completions
    )
    .slice(0, limit);
}

/** Overall graded-attempt pass rate, or null when nothing is graded yet. */
export async function getPassRate(): Promise<number | null> {
  const [graded, passed] = await Promise.all([
    prisma.attempt.count({ where: { status: "GRADED" } }),
    prisma.attempt.count({ where: { status: "GRADED", passed: true } }),
  ]);
  return graded > 0 ? Math.round((passed / graded) * 100) : null;
}
