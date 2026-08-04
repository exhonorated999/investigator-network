import { prisma } from "@/lib/prisma";
import { periodStart, type PeriodKey } from "@/lib/analytics";

/**
 * Course metrics for the admin view — total time on course, the most engaged
 * learners, and when each was last seen. All time comes from CourseActivity
 * buckets so everything filters cleanly by calendar period.
 */

export interface CourseTimeTotal {
  courseId: string;
  title: string;
  seconds: number;
  learners: number;
}

/** Total engaged seconds per course within the period, busiest first. */
export async function courseTimeTotals(period: PeriodKey): Promise<CourseTimeTotal[]> {
  const since = periodStart(period);
  const [rows, courses] = await Promise.all([
    prisma.courseActivity.groupBy({
      by: ["courseId"],
      where: { day: { gte: since } },
      _sum: { seconds: true },
      _count: { userId: true },
    }),
    prisma.course.findMany({ select: { id: true, title: true } }),
  ]);
  const titleById = new Map(courses.map((c) => [c.id, c.title]));

  return rows
    .map((r) => ({
      courseId: r.courseId,
      title: titleById.get(r.courseId) ?? "Unknown course",
      seconds: r._sum.seconds ?? 0,
      learners: r._count.userId,
    }))
    .sort((a, b) => b.seconds - a.seconds);
}

export interface TopLearner {
  userId: string;
  name: string;
  agency: string;
  seconds: number;
  lastSeenAt: Date | null;
  unitsCompleted: number;
}

/** Most engaged learners on one course within the period. */
export async function courseTopLearners(
  courseId: string,
  period: PeriodKey,
  limit = 20
): Promise<TopLearner[]> {
  const since = periodStart(period);

  const rows = await prisma.courseActivity.groupBy({
    by: ["userId"],
    where: { courseId, day: { gte: since } },
    _sum: { seconds: true },
    orderBy: { _sum: { seconds: "desc" } },
    take: limit,
  });
  if (rows.length === 0) return [];

  const userIds = rows.map((r) => r.userId);
  const [users, unitRows] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, agency: true, lastSeenAt: true },
    }),
    // Units completed on this course in the period, per user.
    prisma.unitProgress.findMany({
      where: {
        userId: { in: userIds },
        status: "COMPLETE",
        completedAt: { gte: since },
        unit: { section: { courseId } },
      },
      select: { userId: true },
    }),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const unitsByUser = new Map<string, number>();
  for (const r of unitRows) {
    unitsByUser.set(r.userId, (unitsByUser.get(r.userId) ?? 0) + 1);
  }

  return rows.map((r) => {
    const u = userById.get(r.userId);
    return {
      userId: r.userId,
      name: u?.name ?? "Unknown",
      agency: u?.agency ?? "",
      seconds: r._sum.seconds ?? 0,
      lastSeenAt: u?.lastSeenAt ?? null,
      unitsCompleted: unitsByUser.get(r.userId) ?? 0,
    };
  });
}

/** `3h 12m` / `48m` / `<1m`. */
export function formatTime(seconds: number): string {
  if (seconds < 60) return "<1m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
