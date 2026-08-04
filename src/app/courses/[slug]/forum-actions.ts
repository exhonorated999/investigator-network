"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireViewer } from "@/lib/viewer";

/** Can this viewer participate in a course forum? Enrolled learners + admins. */
async function canParticipate(courseId: string, userId: string, isAdmin: boolean) {
  if (isAdmin) return true;
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  return !!enrollment;
}

export async function askQuestion(formData: FormData) {
  const viewer = await requireViewer();
  const courseId = String(formData.get("courseId"));
  const slug = String(formData.get("slug"));
  const body = String(formData.get("body") || "").trim();
  if (!courseId || body.length < 3) return;

  if (!(await canParticipate(courseId, viewer.id, viewer.role === "ADMIN"))) return;

  await prisma.courseQuestion.create({
    data: { courseId, authorId: viewer.id, body: body.slice(0, 4000) },
  });
  if (slug) revalidatePath(`/courses/${slug}`);
  revalidatePath("/admin");
}

export async function answerQuestion(formData: FormData) {
  const viewer = await requireViewer();
  const questionId = String(formData.get("questionId"));
  const slug = String(formData.get("slug"));
  const body = String(formData.get("body") || "").trim();
  if (!questionId || body.length < 1) return;

  const question = await prisma.courseQuestion.findUnique({
    where: { id: questionId },
    select: { courseId: true },
  });
  if (!question) return;

  const isAdmin = viewer.role === "ADMIN";
  if (!(await canParticipate(question.courseId, viewer.id, isAdmin))) return;

  await prisma.courseAnswer.create({
    data: {
      questionId,
      authorId: viewer.id,
      body: body.slice(0, 4000),
      staff: isAdmin,
    },
  });
  // A staff reply auto-resolves the thread; peers leave it open.
  if (isAdmin) {
    await prisma.courseQuestion.update({
      where: { id: questionId },
      data: { resolved: true },
    });
  }
  if (slug) revalidatePath(`/courses/${slug}`);
  revalidatePath("/admin");
}

/** Toggle resolved. The asker or any admin may flip it. */
export async function setQuestionResolved(formData: FormData) {
  const viewer = await requireViewer();
  const questionId = String(formData.get("questionId"));
  const slug = String(formData.get("slug"));
  const resolved = String(formData.get("resolved")) === "true";

  const question = await prisma.courseQuestion.findUnique({
    where: { id: questionId },
    select: { authorId: true },
  });
  if (!question) return;
  if (viewer.role !== "ADMIN" && question.authorId !== viewer.id) return;

  await prisma.courseQuestion.update({
    where: { id: questionId },
    data: { resolved },
  });
  if (slug) revalidatePath(`/courses/${slug}`);
  revalidatePath("/admin");
}
