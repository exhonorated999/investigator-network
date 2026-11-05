import { prisma } from "@/lib/prisma";
import { summarizeEngagement, type EngagementSummary } from "@/lib/user-stats-calc";

export interface UserStats extends EngagementSummary {
  courseTitles: Record<string, { title: string; slug: string }>;
  mostVisited: { courseId: string; title: string; slug: string; seconds: number; share: number } | null;
  lessonsCompleted: number;
  lastLessonAt: Date | null;
  quizAttempts: number;
  quizPassed: number;
  quizAvgScore: number | null;
  submissions: number;
  submissionsPassed: number;
  certificates: number;
  communityPosts: number;
  boardPosts: number;
  messagesSent: number;
}

/** Engagement + learning stats for the admin user profile page. */
export async function loadUserStats(userId: string): Promise<UserStats> {
  const [
    site, course, lessonsCompleted, lastLesson, quiz, quizPassed, subs, subsPassed,
    certificates, posts, comments, boardPosts, boardReplies, questions, messagesSent,
  ] = await Promise.all([
    prisma.siteActivity.findMany({ where: { userId }, select: { day: true, seconds: true } }),
    prisma.courseActivity.findMany({ where: { userId }, select: { day: true, seconds: true, courseId: true } }),
    prisma.unitProgress.count({ where: { userId, status: "COMPLETE" } }),
    prisma.unitProgress.findFirst({
      where: { userId, status: "COMPLETE", completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    }),
    prisma.attempt.aggregate({ where: { userId }, _count: { _all: true }, _avg: { score: true } }),
    prisma.attempt.count({ where: { userId, passed: true } }),
    prisma.assignmentSubmission.count({ where: { userId } }),
    prisma.assignmentSubmission.count({ where: { userId, status: "PASSED" } }),
    prisma.certificate.count({ where: { userId } }),
    prisma.post.count({ where: { authorId: userId } }),
    prisma.postComment.count({ where: { authorId: userId } }),
    prisma.boardPost.count({ where: { authorId: userId } }),
    prisma.boardReply.count({ where: { authorId: userId } }),
    prisma.courseQuestion.count({ where: { authorId: userId } }),
    prisma.message.count({ where: { senderId: userId } }),
  ]);

  const summary = summarizeEngagement(site, course);

  const ids = summary.perCourse.map((p) => p.courseId);
  const courses = ids.length
    ? await prisma.course.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, slug: true } })
    : [];
  const courseTitles = Object.fromEntries(courses.map((c) => [c.id, { title: c.title, slug: c.slug }]));

  const top = summary.perCourse[0];
  const mostVisited =
    top && courseTitles[top.courseId]
      ? {
          courseId: top.courseId,
          ...courseTitles[top.courseId],
          seconds: top.seconds,
          share: summary.courseSeconds ? top.seconds / summary.courseSeconds : 0,
        }
      : null;

  return {
    ...summary,
    courseTitles,
    mostVisited,
    lessonsCompleted,
    lastLessonAt: lastLesson?.completedAt ?? null,
    quizAttempts: quiz._count._all,
    quizPassed,
    quizAvgScore: quiz._avg.score == null ? null : Math.round(quiz._avg.score),
    submissions: subs,
    submissionsPassed: subsPassed,
    certificates,
    communityPosts: posts + comments + questions,
    boardPosts: boardPosts + boardReplies,
    messagesSent,
  };
}
