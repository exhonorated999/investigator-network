import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Certificate issuance. A learner earns a certificate when every unit in a
 * course is marked COMPLETE. Issuance is idempotent (unique userId+courseId).
 */

function makeSerial(): string {
  const year = new Date().getFullYear();
  const rand = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `IN-${year}-${rand}`;
}

/** True when the user has completed all units of the course. */
export async function isCourseComplete(
  userId: string,
  courseId: string
): Promise<boolean> {
  const units = await prisma.unit.findMany({
    where: { section: { courseId } },
    select: { id: true },
  });
  if (units.length === 0) return false;
  const done = await prisma.unitProgress.count({
    where: {
      userId,
      status: "COMPLETE",
      unitId: { in: units.map((u) => u.id) },
    },
  });
  return done >= units.length;
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
