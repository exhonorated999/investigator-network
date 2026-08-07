import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Certificate issuance. Issuance is idempotent (unique userId+courseId).
 *
 * Two completion models, selected automatically per course:
 *
 *  - HYBRID (a course that offers both a live path and a self-paced path —
 *    detected as "has at least one LIVE_SESSION unit AND at least one VIDEO
 *    unit"): the learner completes the course by EITHER attending one live
 *    session OR finishing the entire on-demand video track. Course Notes and
 *    the certificate placeholder unit are never required on this path.
 *
 *  - STANDARD (everything else): every unit in the course must be COMPLETE.
 */

function makeSerial(): string {
  const year = new Date().getFullYear();
  const rand = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `IN-${year}-${rand}`;
}

/**
 * True when the user has satisfied the course's completion requirements.
 *
 * See the module doc above for the hybrid vs standard rule.
 */
export async function isCourseComplete(
  userId: string,
  courseId: string
): Promise<boolean> {
  const units = await prisma.unit.findMany({
    where: { section: { courseId } },
    select: { id: true, type: true },
  });
  if (units.length === 0) return false;

  const completeRows = await prisma.unitProgress.findMany({
    where: {
      userId,
      status: "COMPLETE",
      unitId: { in: units.map((u) => u.id) },
    },
    select: { unitId: true },
  });
  const done = new Set(completeRows.map((r) => r.unitId));

  const liveUnits = units.filter((u) => u.type === "LIVE_SESSION");
  const videoUnits = units.filter((u) => u.type === "VIDEO");
  const isHybrid = liveUnits.length > 0 && videoUnits.length > 0;

  if (isHybrid) {
    const attendedLive = liveUnits.some((u) => done.has(u.id));
    const finishedAllVideos = videoUnits.every((u) => done.has(u.id));
    return attendedLive || finishedAllVideos;
  }

  // Standard: every unit must be complete.
  return units.every((u) => done.has(u.id));
}

/**
 * Issue a certificate if the course is complete and none exists yet.
 * Returns the certificate (existing or new), or null if not yet earned.
 */
export async function maybeIssueCertificate(userId: string, courseId: string) {
  const existing = await prisma.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return existing;

  if (!(await isCourseComplete(userId, courseId))) return null;

  try {
    return await prisma.certificate.create({
      data: { userId, courseId, serial: makeSerial() },
    });
  } catch {
    // Race: another request issued it first.
    return prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
  }
}
