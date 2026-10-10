"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { maybeIssueCertificate } from "@/lib/certificate";
import { evaluationFor } from "@/lib/evaluation-config";

export interface EvalFormState {
  error: string | null;
}

const MAX_TEXT = 4000;

/**
 * Record a learner's end-of-course evaluation, then try to issue the
 * certificate (which is held until the evaluation exists).
 */
export async function submitEvaluation(
  _prev: EvalFormState,
  formData: FormData
): Promise<EvalFormState> {
  const session = await requireUser();
  const userId = session.user!.id as string;
  const slug = String(formData.get("slug") || "");

  const course = await prisma.course.findUnique({
    where: { slug },
    select: { id: true },
  });
  const config = evaluationFor(slug);
  if (!course || !config) return { error: "This course has no evaluation." };

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
    select: { id: true },
  });
  if (!enrollment) return { error: "You are not enrolled in this course." };

  const answers: Record<string, number | boolean | string> = {};
  for (const q of config.questions) {
    const raw = String(formData.get(q.id) ?? "").trim();
    if (q.kind === "stars") {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return { error: `Please rate: ${q.label}` };
      }
      answers[q.id] = n;
    } else if (q.kind === "yesno") {
      if (raw !== "yes" && raw !== "no") {
        return { error: `Please answer: ${q.label}` };
      }
      answers[q.id] = raw === "yes";
    } else {
      if (q.required && !raw) return { error: `Please answer: ${q.label}` };
      answers[q.id] = raw.slice(0, MAX_TEXT);
    }
  }

  let testimonialOk = false;
  let testimonial: string | null = null;
  if (config.testimonial) {
    const t = String(formData.get("testimonialOk") ?? "");
    if (t !== "yes" && t !== "no") {
      return { error: "Please answer whether you'd write a testimonial." };
    }
    testimonialOk = t === "yes";
    if (testimonialOk) {
      testimonial = String(formData.get("testimonial") ?? "").trim().slice(0, MAX_TEXT);
      if (!testimonial) return { error: "Please write your testimonial (or choose No)." };
    }
  }

  try {
    await prisma.courseEvaluation.create({
      data: { userId, courseId: course.id, answers, testimonialOk, testimonial },
    });
  } catch {
    // Unique (userId, courseId): already submitted — fall through and issue.
  }

  const cert = await maybeIssueCertificate(userId, course.id);
  revalidatePath(`/courses/${slug}`);
  revalidatePath("/dashboard");
  revalidatePath("/admin/evaluations");
  redirect(cert ? `/certificates/${cert.serial}` : `/courses/${slug}`);
}
