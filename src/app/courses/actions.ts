"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { saveFile } from "@/lib/storage";

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

  const enrolled = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrolled) redirect(`/courses/${slug}`);

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

  revalidatePath(`/courses/${slug}/units/${unitId}`);
  revalidatePath(`/courses/${slug}`);
  revalidatePath("/dashboard");
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

  const enrolled = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrolled) redirect(`/courses/${slug}`);

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

  revalidatePath(`/courses/${slug}/units/${unitId}`);
  revalidatePath("/dashboard");
}
