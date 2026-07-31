import { prisma } from "@/lib/prisma";

/**
 * Presence tracking.
 *
 * A user is "online" if their browser sent a heartbeat within
 * PRESENCE_WINDOW_MS. The client beacon pings every HEARTBEAT_INTERVAL_MS, so
 * the window is deliberately a few multiples of the interval — that way one
 * dropped ping (sleeping laptop, flaky wifi, tab throttled in the background)
 * does not make someone flicker offline.
 */
export const HEARTBEAT_INTERVAL_MS = 45_000;
export const PRESENCE_WINDOW_MS = 3 * 60_000;
/** Idle = still within the window but hasn't pinged for a while. */
export const IDLE_AFTER_MS = 90_000;

export function presenceCutoff(now = new Date()): Date {
  return new Date(now.getTime() - PRESENCE_WINDOW_MS);
}

/**
 * Record a heartbeat. `path` is the learner-facing route they were on; we
 * resolve it to a course/unit so staff can see what someone is working on.
 *
 * Resolution is best-effort: an unrecognized path just clears the course, and
 * any failure is swallowed by the caller. Presence is telemetry, never a
 * reason to fail a request.
 */
export async function recordHeartbeat(userId: string, path: string) {
  const { courseId, unitId } = await resolveLocation(path);

  await prisma.user.update({
    where: { id: userId },
    data: {
      lastSeenAt: new Date(),
      lastSeenPath: path.slice(0, 512),
      lastSeenCourseId: courseId,
      lastSeenUnitId: unitId,
    },
  });
}

/**
 * Map a URL path to a course/unit. Learner course routes look like
 * `/courses/{slug}` and `/courses/{slug}/units/{unitId}`.
 */
async function resolveLocation(
  path: string
): Promise<{ courseId: string | null; unitId: string | null }> {
  const m = /^\/courses\/([^/?#]+)(?:\/units\/([^/?#]+))?/.exec(path);
  if (!m) return { courseId: null, unitId: null };

  const [, slug, unitId] = m;
  const course = await prisma.course.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!course) return { courseId: null, unitId: null };

  // Only trust the unit id if it really belongs to this course, so a stale or
  // hand-edited URL can't attach a foreign unit to the presence row.
  let validUnitId: string | null = null;
  if (unitId) {
    const unit = await prisma.unit.findFirst({
      where: { id: unitId, section: { courseId: course.id } },
      select: { id: true },
    });
    validUnitId = unit?.id ?? null;
  }

  return { courseId: course.id, unitId: validUnitId };
}

export interface OnlineUser {
  id: string;
  name: string;
  agency: string;
  role: string;
  lastSeenAt: Date;
  idle: boolean;
  courseId: string | null;
  courseTitle: string | null;
  unitTitle: string | null;
  path: string | null;
}

/** Everyone currently online, most recently active first. */
export async function getOnlineUsers(limit = 50): Promise<OnlineUser[]> {
  const cutoff = presenceCutoff();

  const rows = await prisma.user.findMany({
    where: { lastSeenAt: { gte: cutoff } },
    orderBy: { lastSeenAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      agency: true,
      role: true,
      lastSeenAt: true,
      lastSeenPath: true,
      lastSeenUnitId: true,
      lastSeenCourse: { select: { id: true, title: true } },
    },
  });

  // Resolve unit titles in one query rather than per row.
  const unitIds = rows
    .map((r) => r.lastSeenUnitId)
    .filter((v): v is string => Boolean(v));
  const units = unitIds.length
    ? await prisma.unit.findMany({
        where: { id: { in: unitIds } },
        select: { id: true, title: true },
      })
    : [];
  const unitTitle = new Map(units.map((u) => [u.id, u.title]));

  const idleBefore = Date.now() - IDLE_AFTER_MS;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    agency: r.agency,
    role: r.role,
    lastSeenAt: r.lastSeenAt!,
    idle: r.lastSeenAt!.getTime() < idleBefore,
    courseId: r.lastSeenCourse?.id ?? null,
    courseTitle: r.lastSeenCourse?.title ?? null,
    unitTitle: r.lastSeenUnitId
      ? (unitTitle.get(r.lastSeenUnitId) ?? null)
      : null,
    path: r.lastSeenPath,
  }));
}

/** Count of users online right now. */
export function countOnline(): Promise<number> {
  return prisma.user.count({ where: { lastSeenAt: { gte: presenceCutoff() } } });
}

/**
 * How many people are in each course right now, busiest first. Only counts
 * users whose current location resolved to a course.
 */
export async function getCourseOccupancy(): Promise<
  { courseId: string; title: string; count: number }[]
> {
  const rows = await prisma.user.groupBy({
    by: ["lastSeenCourseId"],
    where: {
      lastSeenAt: { gte: presenceCutoff() },
      lastSeenCourseId: { not: null },
    },
    _count: { _all: true },
  });

  if (rows.length === 0) return [];

  const courses = await prisma.course.findMany({
    where: { id: { in: rows.map((r) => r.lastSeenCourseId!) } },
    select: { id: true, title: true },
  });
  const titleById = new Map(courses.map((c) => [c.id, c.title]));

  return rows
    .map((r) => ({
      courseId: r.lastSeenCourseId!,
      title: titleById.get(r.lastSeenCourseId!) ?? "Unknown course",
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count);
}
