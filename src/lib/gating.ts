import { prisma } from "@/lib/prisma";

/**
 * Cross-unit prerequisite gating.
 *
 * The player navigates units freely (prev/next), and per-unit completion is
 * tracked independently. That's fine for most courses, but some — like Advanced
 * Datapilot — require the hands-on work (the FILE_ASSIGNMENT "capture the flag"
 * units) to be finished before the graded QUIZ test is unlocked.
 *
 * The rule is intentionally simple and course-agnostic: **a QUIZ unit is locked
 * until every FILE_ASSIGNMENT unit in the same course is COMPLETE.** A course
 * with no file assignments has nothing to wait on, so its tests are never
 * gated. This is enforced both in the player (to hide the test form) and in the
 * submit action (because a hidden form is a courtesy, not a control).
 */
export interface TestGate {
  /** Total FILE_ASSIGNMENT units in the course. */
  total: number;
  /** How many the learner has completed. */
  done: number;
  /** True when the test may be taken (all assignments complete, or none exist). */
  unlocked: boolean;
  /** Titles of the assignments still outstanding, for a helpful message. */
  outstanding: string[];
}

export async function testGate(
  userId: string,
  courseId: string
): Promise<TestGate> {
  const assignments = await prisma.unit.findMany({
    where: { type: "FILE_ASSIGNMENT", section: { courseId } },
    select: { id: true, title: true },
  });

  if (assignments.length === 0) {
    return { total: 0, done: 0, unlocked: true, outstanding: [] };
  }

  const completeRows = await prisma.unitProgress.findMany({
    where: {
      userId,
      status: "COMPLETE",
      unitId: { in: assignments.map((a) => a.id) },
    },
    select: { unitId: true },
  });
  const done = new Set(completeRows.map((r) => r.unitId));

  const outstanding = assignments
    .filter((a) => !done.has(a.id))
    .map((a) => a.title);

  return {
    total: assignments.length,
    done: done.size,
    unlocked: outstanding.length === 0,
    outstanding,
  };
}
