import { prisma } from "@/lib/prisma";

/**
 * "New enrollees since the last live session" — for live-training reminders.
 *
 * For each course that has a LIVE_SESSION unit, we find the most recent *past*
 * session date (from the unit's JSON `data.startsAt`) and list the learners
 * who enrolled after it. Those are the people who joined since the last live
 * class and may need a heads-up about the next one. No session yet → everyone
 * enrolled counts as "new".
 */

export interface ReminderEnrollee {
  userId: string;
  name: string;
  email: string;
  enrolledAt: Date;
}

export interface CourseReminder {
  courseId: string;
  title: string;
  slug: string;
  lastSessionAt: Date | null;
  nextSessionAt: Date | null;
  enrollees: ReminderEnrollee[];
}

function parseStartsAt(data: unknown): Date | null {
  if (!data || typeof data !== "object") return null;
  const raw = (data as { startsAt?: unknown }).startsAt;
  if (typeof raw !== "string" || !raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function loadLiveTrainingReminders(): Promise<CourseReminder[]> {
  const now = new Date();

  // Every live-session unit, with its course.
  const liveUnits = await prisma.unit.findMany({
    where: { type: "LIVE_SESSION" },
    select: {
      data: true,
      section: { select: { course: { select: { id: true, title: true, slug: true } } } },
    },
  });
  if (liveUnits.length === 0) return [];

  // Collapse to per-course last-past / next-upcoming session dates.
  const byCourse = new Map<
    string,
    { title: string; slug: string; last: Date | null; next: Date | null }
  >();
  for (const u of liveUnits) {
    const course = u.section.course;
    const when = parseStartsAt(u.data);
    const entry =
      byCourse.get(course.id) ??
      { title: course.title, slug: course.slug, last: null, next: null };
    if (when) {
      if (when <= now && (!entry.last || when > entry.last)) entry.last = when;
      if (when > now && (!entry.next || when < entry.next)) entry.next = when;
    }
    byCourse.set(course.id, entry);
  }

  const result: CourseReminder[] = [];
  for (const [courseId, info] of byCourse) {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        courseId,
        ...(info.last ? { enrolledAt: { gt: info.last } } : {}),
      },
      orderBy: { enrolledAt: "desc" },
      select: {
        enrolledAt: true,
        user: { select: { id: true, name: true, email: true, status: true } },
      },
    });

    result.push({
      courseId,
      title: info.title,
      slug: info.slug,
      lastSessionAt: info.last,
      nextSessionAt: info.next,
      enrollees: enrollments
        .filter((e) => e.user.status === "APPROVED")
        .map((e) => ({
          userId: e.user.id,
          name: e.user.name,
          email: e.user.email,
          enrolledAt: e.enrolledAt,
        })),
    });
  }

  // Courses with people to notify first, then by soonest upcoming session.
  return result.sort(
    (a, b) =>
      b.enrollees.length - a.enrollees.length ||
      (a.nextSessionAt?.getTime() ?? Infinity) - (b.nextSessionAt?.getTime() ?? Infinity)
  );
}
