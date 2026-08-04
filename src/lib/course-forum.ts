import { prisma } from "@/lib/prisma";

/** A question plus its answers, shaped for the course forum + admin surfaces. */
export type ForumQuestion = Awaited<ReturnType<typeof loadQuestions>>[number];

const ANSWER_INCLUDE = {
  answers: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { id: true, name: true, role: true } } },
  },
  author: { select: { id: true, name: true, role: true } },
} as const;

/** All questions for one course, newest first, with answers + authors. */
export async function loadQuestions(courseId: string) {
  return prisma.courseQuestion.findMany({
    where: { courseId },
    orderBy: [{ resolved: "asc" }, { createdAt: "desc" }],
    include: ANSWER_INCLUDE,
  });
}

/**
 * Open (unresolved) questions across every course, newest first — powers the
 * admin dashboard queue so staff can answer without leaving it.
 */
export async function loadOpenQuestions(limit = 8) {
  return prisma.courseQuestion.findMany({
    where: { resolved: false },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      ...ANSWER_INCLUDE,
      course: { select: { title: true, slug: true } },
    },
  });
}

/** Count of open questions — for the dashboard "needs you" strip. */
export function countOpenQuestions() {
  return prisma.courseQuestion.count({ where: { resolved: false } });
}
