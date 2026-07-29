"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import type { QuestionType } from "@prisma/client";

function unitPath(courseId: string, unitId: string) {
  revalidatePath(`/admin/courses/${courseId}/units/${unitId}`);
}

/** Ensure a Quiz exists for a unit (older QUIZ units may predate this). */
export async function ensureQuiz(unitId: string, title: string) {
  const existing = await prisma.quiz.findUnique({ where: { unitId } });
  if (existing) return existing;
  return prisma.quiz.create({ data: { unitId, title, passScore: 70 } });
}

export async function updateQuiz(formData: FormData) {
  await requireAdmin();
  const quizId = String(formData.get("quizId"));
  const courseId = String(formData.get("courseId"));
  const unitId = String(formData.get("unitId"));
  const title = String(formData.get("title") || "").trim() || "Untitled quiz";
  const passScore = Math.min(100, Math.max(0, Number(formData.get("passScore") || 70)));
  await prisma.quiz.update({ where: { id: quizId }, data: { title, passScore } });
  unitPath(courseId, unitId);
}

export async function addQuestion(formData: FormData) {
  await requireAdmin();
  const quizId = String(formData.get("quizId"));
  const courseId = String(formData.get("courseId"));
  const unitId = String(formData.get("unitId"));
  const type = String(formData.get("type")) as QuestionType;
  const prompt = String(formData.get("prompt") || "").trim() || "Untitled question";
  const points = Math.max(1, Number(formData.get("points") || 1));
  const count = await prisma.question.count({ where: { quizId } });

  const question = await prisma.question.create({
    data: { quizId, type, prompt, points, order: count },
  });

  // Seed two blank choices for multiple-choice questions.
  if (type === "MULTIPLE_CHOICE") {
    await prisma.choice.createMany({
      data: [
        { questionId: question.id, text: "", isCorrect: true },
        { questionId: question.id, text: "", isCorrect: false },
      ],
    });
  }
  unitPath(courseId, unitId);
}

export async function updateQuestion(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const courseId = String(formData.get("courseId"));
  const unitId = String(formData.get("unitId"));
  const prompt = String(formData.get("prompt") || "").trim();
  const points = Math.max(1, Number(formData.get("points") || 1));
  await prisma.question.update({
    where: { id },
    data: { prompt: prompt || "Untitled question", points },
  });
  unitPath(courseId, unitId);
}

export async function deleteQuestion(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const courseId = String(formData.get("courseId"));
  const unitId = String(formData.get("unitId"));
  await prisma.question.delete({ where: { id } });
  unitPath(courseId, unitId);
}

export async function addChoice(formData: FormData) {
  await requireAdmin();
  const questionId = String(formData.get("questionId"));
  const courseId = String(formData.get("courseId"));
  const unitId = String(formData.get("unitId"));
  await prisma.choice.create({ data: { questionId, text: "", isCorrect: false } });
  unitPath(courseId, unitId);
}

export async function updateChoice(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const courseId = String(formData.get("courseId"));
  const unitId = String(formData.get("unitId"));
  const text = String(formData.get("text") || "").trim();
  await prisma.choice.update({ where: { id }, data: { text } });
  unitPath(courseId, unitId);
}

/** Mark one choice correct; unset the others in the same question. */
export async function setCorrectChoice(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const questionId = String(formData.get("questionId"));
  const courseId = String(formData.get("courseId"));
  const unitId = String(formData.get("unitId"));
  await prisma.$transaction([
    prisma.choice.updateMany({ where: { questionId }, data: { isCorrect: false } }),
    prisma.choice.update({ where: { id }, data: { isCorrect: true } }),
  ]);
  unitPath(courseId, unitId);
}

export async function deleteChoice(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const courseId = String(formData.get("courseId"));
  const unitId = String(formData.get("unitId"));
  await prisma.choice.delete({ where: { id } });
  unitPath(courseId, unitId);
}
