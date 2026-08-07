"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { readNotesDoc } from "@/lib/blocks";
import { computeGate, loadInteractions } from "@/lib/interactions";
import { saveFile } from "@/lib/storage";
import { maybeIssueCertificate } from "@/lib/certificate";
import { testGate } from "@/lib/gating";

/**
 * Ensure the acting user may record progress on a course.
 *
 * Learners must already be enrolled (they can only reach a unit through an
 * enrollment). Admins, however, can open any course in preview without an
 * enrollment — so a completion click would otherwise silently no-op. When an
 * admin acts on a course they are not enrolled in, we auto-enroll them so the
 * "Mark as complete" / submit flows behave exactly as they do for a learner,
 * letting admins test the full completion → certificate path.
 *
 * Returns true when the caller may proceed; false means bounce them back to the
 * course landing page.
 */
async function ensureCanRecord(
  userId: string,
  role: string | undefined,
  courseId: string
): Promise<boolean> {
  const enrolled = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (enrolled) return true;
  if (role === "ADMIN") {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {},
      create: { userId, courseId },
    });
    return true;
  }
  return false;
}

/** Enroll the current user in a published course, then open the first unit. */
export async function enroll(formData: FormData) {
  const session = await requireUser();
  const userId = session.user.id;
  const slug = String(formData.get("slug") || "");

  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: { units: { orderBy: { order: "asc" }, take: 1 } },
      },
    },
  });
  if (!course || course.status !== "PUBLISHED") redirect("/dashboard");

  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId: course.id } },
    update: {},
    create: { userId, courseId: course.id },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/courses/${slug}`);

  const firstUnit = course.sections.flatMap((s) => s.units)[0];
  if (firstUnit) redirect(`/courses/${slug}/units/${firstUnit.id}`);
  redirect(`/courses/${slug}`);
}

/** Toggle a unit's completion for the current user. */
export async function setUnitComplete(formData: FormData) {
  const session = await requireUser();
  const userId = session.user.id;
  const unitId = String(formData.get("unitId") || "");
  const slug = String(formData.get("slug") || "");
  const complete = String(formData.get("complete") || "true") === "true";

  // Ensure the user is enrolled in the owning course.
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { section: { include: { course: true } } },
  });
  if (!unit) redirect("/dashboard");
  const courseId = unit.section.course.id;

  if (!(await ensureCanRecord(userId, session.user.role, courseId))) {
    redirect(`/courses/${slug}`);
  }

  // A NOTES unit can require its interactive blocks to be answered first. The
  // button is already disabled client-side, but the gate is re-checked here
  // because a disabled button is a courtesy, not a control.
  if (complete && unit.type === "NOTES") {
    const blocks = readNotesDoc(
      (unit.data as Record<string, unknown>) ?? {}
    ).blocks;
    const answers = await loadInteractions(userId, unitId);
    if (!computeGate(blocks, answers).passed) {
      // Nothing to tell the user that the page does not already show — just
      // refuse the write and let the re-render restate what is outstanding.
      revalidatePath(`/courses/${slug}/units/${unitId}`);
      return;
    }
  }

  await prisma.unitProgress.upsert({
    where: { userId_unitId: { userId, unitId } },
    update: {
      status: complete ? "COMPLETE" : "INCOMPLETE",
      completedAt: complete ? new Date() : null,
    },
    create: {
      userId,
      unitId,
      status: complete ? "COMPLETE" : "INCOMPLETE",
      completedAt: complete ? new Date() : null,
    },
  });

  if (complete) await maybeIssueCertificate(userId, courseId);

  revalidatePath(`/courses/${slug}/units/${unitId}`);
  revalidatePath(`/courses/${slug}`);
  revalidatePath("/dashboard");
}

/** Learner submits a quiz attempt. Auto-grades MC; DOC answers await manual grading. */
export async function submitAttempt(formData: FormData) {
  const session = await requireUser();
  const userId = session.user.id;
  const unitId = String(formData.get("unitId") || "");
  const slug = String(formData.get("slug") || "");

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      section: { include: { course: true } },
      quiz: { include: { questions: { include: { choices: true } } } },
    },
  });
  if (!unit || !unit.quiz) redirect("/dashboard");
  const courseId = unit.section.course.id;
  const quiz = unit.quiz;

  if (!(await ensureCanRecord(userId, session.user.role, courseId))) {
    redirect(`/courses/${slug}`);
  }

  // Prerequisite gate: the test is locked until every capture-the-flag
  // assignment is complete. The form is hidden in that state, but re-check here.
  if (!(await testGate(userId, courseId)).unlocked) {
    redirect(`/courses/${slug}/units/${unitId}`);
  }

  // Block resubmission if a passed or pending attempt already exists.
  const latest = await prisma.attempt.findFirst({
    where: { quizId: quiz.id, userId },
    orderBy: { submittedAt: "desc" },
  });
  if (latest && (latest.status === "PENDING_GRADING" || latest.passed)) {
    redirect(`/courses/${slug}/units/${unitId}`);
  }

  const attempt = await prisma.attempt.create({
    data: { quizId: quiz.id, userId, status: "PENDING_GRADING" },
  });

  // The attempt is now of record — discard any in-progress draft so a resumed
  // visit starts clean.
  await prisma.quizDraft.deleteMany({ where: { userId, quizId: quiz.id } });

  let needsGrading = false;
  let earned = 0;
  const totalPoints = quiz.questions.reduce((n, q) => n + q.points, 0) || 1;

  for (const q of quiz.questions) {
    if (q.type === "MULTIPLE_CHOICE" && q.multiSelect) {
      // Multi-select: full points only when the chosen set exactly matches the
      // set of correct choices (no missing, no extra).
      const picked = [
        ...new Set(formData.getAll(`q_${q.id}`).map((v) => String(v)).filter(Boolean)),
      ].sort();
      const correctIds = q.choices
        .filter((c) => c.isCorrect)
        .map((c) => c.id)
        .sort();
      const exact =
        picked.length === correctIds.length &&
        picked.every((id, i) => id === correctIds[i]);
      const awarded = exact ? q.points : 0;
      earned += awarded;
      await prisma.answer.create({
        data: {
          attemptId: attempt.id,
          questionId: q.id,
          selectedChoiceIds: picked,
          awardedPoints: awarded,
        },
      });
    } else if (q.type === "MULTIPLE_CHOICE") {
      const choiceId = String(formData.get(`q_${q.id}`) || "");
      const choice = q.choices.find((c) => c.id === choiceId);
      const awarded = choice?.isCorrect ? q.points : 0;
      earned += awarded;
      await prisma.answer.create({
        data: {
          attemptId: attempt.id,
          questionId: q.id,
          selectedChoiceId: choice ? choice.id : null,
          awardedPoints: awarded,
        },
      });
    } else {
      // DOCUMENT_UPLOAD
      needsGrading = true;
      const file = formData.get(`file_${q.id}`);
      let uploadedFileId: string | null = null;
      if (file instanceof File && file.size > 0) {
        const stored = await saveFile(file as File, `attempts/${attempt.id}`);
        const rec = await prisma.fileUpload.create({
          data: {
            ownerUserId: userId,
            path: stored.path,
            filename: stored.filename,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
            purpose: `attempt:${attempt.id}`,
          },
        });
        uploadedFileId = rec.id;
      }
      await prisma.answer.create({
        data: {
          attemptId: attempt.id,
          questionId: q.id,
          uploadedFileId,
          awardedPoints: null,
        },
      });
    }
  }

  if (!needsGrading) {
    const score = Math.round((earned / totalPoints) * 100);
    const passed = score >= quiz.passScore;
    await prisma.attempt.update({
      where: { id: attempt.id },
      data: { status: "GRADED", score, passed },
    });
    if (passed) {
      await prisma.unitProgress.upsert({
        where: { userId_unitId: { userId, unitId } },
        update: { status: "COMPLETE", completedAt: new Date() },
        create: { userId, unitId, status: "COMPLETE", completedAt: new Date() },
      });
      await maybeIssueCertificate(userId, courseId);
    }
  }

  revalidatePath(`/courses/${slug}/units/${unitId}`);
  revalidatePath("/dashboard");
  redirect(`/courses/${slug}/units/${unitId}`);
}

/** Learner uploads a document for a FILE_ASSIGNMENT unit. */
export async function submitAssignment(formData: FormData) {
  const session = await requireUser();
  const userId = session.user.id;
  const unitId = String(formData.get("unitId") || "");
  const slug = String(formData.get("slug") || "");
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirect(`/courses/${slug}/units/${unitId}?error=nofile`);
  }

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { section: { include: { course: true } } },
  });
  if (!unit) redirect("/dashboard");
  const courseId = unit.section.course.id;

  if (!(await ensureCanRecord(userId, session.user.role, courseId))) {
    redirect(`/courses/${slug}`);
  }

  const stored = await saveFile(file as File, `assignments/${unitId}`);
  await prisma.fileUpload.create({
    data: {
      ownerUserId: userId,
      path: stored.path,
      filename: stored.filename,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      purpose: `assignment:${unitId}`,
    },
  });

  // Uploading the assignment marks the unit complete.
  await prisma.unitProgress.upsert({
    where: { userId_unitId: { userId, unitId } },
    update: { status: "COMPLETE", completedAt: new Date() },
    create: { userId, unitId, status: "COMPLETE", completedAt: new Date() },
  });

  await maybeIssueCertificate(userId, courseId);

  revalidatePath(`/courses/${slug}/units/${unitId}`);
  revalidatePath("/dashboard");
}
