"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { maybeIssueCertificate } from "@/lib/certificate";

/**
 * Grade a pending attempt. Admin awards points for each DOCUMENT_UPLOAD answer;
 * MC answers were auto-scored at submission. Recompute total, set pass/fail,
 * and mark the unit complete if the learner passed.
 */
export async function gradeAttempt(formData: FormData) {
  const session = await requireAdmin();
  const adminId = session.user.id;
  const attemptId = String(formData.get("attemptId"));

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: { include: { unit: true, questions: true } },
      answers: { include: { question: true } },
    },
  });
  if (!attempt) redirect("/admin/grading");

  // Persist points/feedback for document-upload answers.
  for (const ans of attempt.answers) {
    if (ans.question.type !== "DOCUMENT_UPLOAD") continue;
    const raw = formData.get(`points_${ans.id}`);
    const feedback = String(formData.get(`feedback_${ans.id}`) || "").trim() || null;
    const max = ans.question.points;
    const awarded = Math.max(0, Math.min(max, Number(raw || 0)));
    await prisma.answer.update({
      where: { id: ans.id },
      data: { awardedPoints: awarded, feedback, gradedById: adminId },
    });
  }

  // Recompute score from all answers.
  const total = attempt.quiz.questions.reduce((n, q) => n + q.points, 0) || 1;
  const fresh = await prisma.answer.findMany({ where: { attemptId } });
  const earned = fresh.reduce((n, a) => n + (a.awardedPoints ?? 0), 0);
  const score = Math.round((earned / total) * 100);
  const passed = score >= attempt.quiz.passScore;

  await prisma.attempt.update({
    where: { id: attemptId },
    data: { status: "GRADED", score, passed },
  });

  if (passed) {
    await prisma.unitProgress.upsert({
      where: { userId_unitId: { userId: attempt.userId, unitId: attempt.quiz.unitId } },
      update: { status: "COMPLETE", completedAt: new Date() },
      create: {
        userId: attempt.userId,
        unitId: attempt.quiz.unitId,
        status: "COMPLETE",
        completedAt: new Date(),
      },
    });
    const courseUnit = await prisma.unit.findUnique({
      where: { id: attempt.quiz.unitId },
      include: { section: true },
    });
    if (courseUnit) {
      await maybeIssueCertificate(attempt.userId, courseUnit.section.courseId);
    }
  }

  revalidatePath("/admin/grading");
  revalidatePath(`/admin/grading/${attemptId}`);
  redirect("/admin/grading");
}
