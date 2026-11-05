/**
 * Pure helpers for per-user engagement stats (no Prisma — unit-tested).
 *
 * Inputs are per-day second totals keyed by "YYYY-MM-DD". Site time was only
 * recorded from Nov 2026; before that only course time exists. Course time is
 * always a subset of site time, so for each day we take the larger of the two
 * — a floor for older days, exact for newer ones, never double counted.
 */

export type DayRow = { day: Date; seconds: number };
export type CourseDayRow = DayRow & { courseId: string };

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export interface EngagementSummary {
  siteSeconds: number;
  courseSeconds: number;
  activeDays: number;
  activeDaysLast30: number;
  avgSecondsPerActiveDay: number;
  longestStreak: number;
  firstActiveDay: string | null;
  lastActiveDay: string | null;
  /** Seconds per course, busiest first. */
  perCourse: { courseId: string; seconds: number; days: number; lastDay: string }[];
  /** Last `windowDays` days, oldest first, seconds of site time per day. */
  daily: { day: string; seconds: number }[];
}

export function summarizeEngagement(
  site: DayRow[],
  course: CourseDayRow[],
  now: Date = new Date(),
  windowDays = 30
): EngagementSummary {
  const siteByDay = new Map<string, number>();
  for (const r of site) siteByDay.set(dayKey(r.day), (siteByDay.get(dayKey(r.day)) ?? 0) + r.seconds);

  const courseByDay = new Map<string, number>();
  const perCourse = new Map<string, { seconds: number; days: Set<string> }>();
  for (const r of course) {
    const k = dayKey(r.day);
    courseByDay.set(k, (courseByDay.get(k) ?? 0) + r.seconds);
    const pc = perCourse.get(r.courseId) ?? { seconds: 0, days: new Set<string>() };
    pc.seconds += r.seconds;
    if (r.seconds > 0) pc.days.add(k);
    perCourse.set(r.courseId, pc);
  }

  const merged = new Map<string, number>();
  for (const k of new Set([...siteByDay.keys(), ...courseByDay.keys()])) {
    const v = Math.max(siteByDay.get(k) ?? 0, courseByDay.get(k) ?? 0);
    if (v > 0) merged.set(k, v);
  }

  const days = [...merged.keys()].sort();
  const siteSeconds = [...merged.values()].reduce((a, b) => a + b, 0);
  const courseSeconds = [...courseByDay.values()].reduce((a, b) => a + b, 0);

  // Longest run of consecutive active days.
  let longestStreak = 0, run = 0, prev: number | null = null;
  for (const k of days) {
    const t = Date.parse(k + "T00:00:00Z") / 86_400_000;
    run = prev !== null && t - prev === 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    prev = t;
  }

  const today = Date.parse(dayKey(now) + "T00:00:00Z");
  const daily: { day: string; seconds: number }[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const k = new Date(today - i * 86_400_000).toISOString().slice(0, 10);
    daily.push({ day: k, seconds: merged.get(k) ?? 0 });
  }

  return {
    siteSeconds,
    courseSeconds,
    activeDays: days.length,
    activeDaysLast30: daily.filter((d) => d.seconds > 0).length,
    avgSecondsPerActiveDay: days.length ? Math.round(siteSeconds / days.length) : 0,
    longestStreak,
    firstActiveDay: days[0] ?? null,
    lastActiveDay: days[days.length - 1] ?? null,
    perCourse: [...perCourse]
      .filter(([, v]) => v.seconds > 0)
      .map(([courseId, v]) => ({
        courseId,
        seconds: v.seconds,
        days: v.days.size,
        lastDay: [...v.days].sort().pop() ?? "",
      }))
      .sort((a, b) => b.seconds - a.seconds),
    daily,
  };
}

/** "2h 14m", "37m", "45s", "—" for zero. */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 1) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}
