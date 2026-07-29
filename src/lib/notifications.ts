import { prisma } from "@/lib/prisma";
import { unitData } from "@/lib/course";

export type NotifKind =
  | "live"
  | "result"
  | "certificate"
  | "grading"
  | "release";

export interface Notification {
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  /** When the event happens (live sessions) or happened (everything else). */
  at: Date | null;
  href: string;
  tone: "cyan" | "gold" | "success" | "danger";
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Derives a learner notification feed from existing data — no separate
 * notification table needed yet: live sessions come from LIVE_SESSION units,
 * results from graded attempts, credentials from certificates.
 */
export async function loadNotifications(userId: string): Promise<Notification[]> {
  const now = Date.now();
  const items: Notification[] = [];

  const [liveUnits, attempts, certificates, newCourses] = await Promise.all([
    prisma.unit.findMany({
      where: {
        type: "LIVE_SESSION",
        section: { course: { enrollments: { some: { userId } } } },
      },
      include: { section: { include: { course: { select: { slug: true, title: true } } } } },
    }),
    prisma.attempt.findMany({
      where: { userId },
      orderBy: { submittedAt: "desc" },
      take: 12,
      include: {
        quiz: {
          include: {
            unit: {
              include: {
                section: { include: { course: { select: { slug: true, title: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.certificate.findMany({
      where: { userId },
      orderBy: { issuedAt: "desc" },
      take: 5,
      include: { course: { select: { title: true } } },
    }),
    prisma.course.findMany({
      where: {
        status: "PUBLISHED",
        enrollments: { none: { userId } },
        updatedAt: { gte: new Date(now - 21 * DAY) },
      },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { id: true, slug: true, title: true, updatedAt: true },
    }),
  ]);

  // --- Live sessions: upcoming, or in progress right now.
  for (const unit of liveUnits) {
    const data = unitData(unit);
    const rawStart = typeof data.startsAt === "string" ? data.startsAt : null;
    if (!rawStart) continue;
    const starts = new Date(rawStart);
    if (Number.isNaN(starts.getTime())) continue;

    const durationMin =
      typeof data.durationMin === "number" ? data.durationMin : 60;
    const endsAt = starts.getTime() + durationMin * 60 * 1000;
    if (endsAt < now) continue; // finished

    const live = starts.getTime() <= now;
    const course = unit.section.course;
    items.push({
      id: `live-${unit.id}`,
      kind: "live",
      title: live ? "Live session in progress" : "Upcoming live session",
      body: `${unit.title} — ${course.title}`,
      at: starts,
      href: `/courses/${course.slug}/units/${unit.id}`,
      tone: live ? "success" : "cyan",
    });
  }

  // --- Assessment outcomes.
  for (const attempt of attempts) {
    const unit = attempt.quiz.unit;
    const course = unit.section.course;
    const href = `/courses/${course.slug}/units/${unit.id}`;

    if (attempt.status === "PENDING_GRADING") {
      items.push({
        id: `grading-${attempt.id}`,
        kind: "grading",
        title: "Awaiting instructor review",
        body: `${attempt.quiz.title} — ${course.title}`,
        at: attempt.submittedAt,
        href,
        tone: "gold",
      });
    } else if (attempt.status === "GRADED") {
      items.push({
        id: `result-${attempt.id}`,
        kind: "result",
        title: attempt.passed ? "Test passed" : "Test not passed",
        body: `${attempt.quiz.title} — score ${attempt.score ?? 0}%`,
        at: attempt.submittedAt,
        href,
        tone: attempt.passed ? "success" : "danger",
      });
    }
  }

  // --- Credentials.
  for (const cert of certificates) {
    items.push({
      id: `cert-${cert.id}`,
      kind: "certificate",
      title: "Certificate issued",
      body: cert.course.title,
      at: cert.issuedAt,
      href: `/certificates/${cert.serial}`,
      tone: "gold",
    });
  }

  // --- Newly published training the learner has not joined.
  for (const course of newCourses) {
    items.push({
      id: `release-${course.id}`,
      kind: "release",
      title: "New training available",
      body: course.title,
      at: course.updatedAt,
      href: `/courses/${course.slug}`,
      tone: "cyan",
    });
  }

  // Upcoming live sessions float to the top, then most recent activity.
  return items.sort((a, b) => {
    const aLive = a.kind === "live" ? 0 : 1;
    const bLive = b.kind === "live" ? 0 : 1;
    if (aLive !== bLive) return aLive - bLive;
    const at = a.at?.getTime() ?? 0;
    const bt = b.at?.getTime() ?? 0;
    return aLive === 0 ? at - bt : bt - at;
  });
}
