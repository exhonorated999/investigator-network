"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { slugify, withSuffix } from "@/lib/slug";
import { defaultUnitData } from "@/lib/units";
import { sendLiveSessionReminder } from "@/lib/email";
import type { UnitType, Prisma } from "@/generated/prisma";

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || "course";
  for (let i = 0; i < 50; i++) {
    const candidate = withSuffix(base, i);
    const existing = await prisma.course.findUnique({
      where: { slug: candidate },
    });
    if (!existing) return candidate;
  }
  return `${base}-${Date.now()}`;
}

async function resolveCategoryId(name: string | null): Promise<string | null> {
  const clean = (name || "").trim();
  if (!clean) return null;
  const cat = await prisma.category.upsert({
    where: { name: clean },
    update: {},
    create: { name: clean },
  });
  return cat.id;
}

// --------------------------- Courses ---------------------------

export async function createCourse(formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") || "").trim();
  if (!title) return;

  const categoryId = await resolveCategoryId(
    formData.get("category") as string | null
  );
  const description = String(formData.get("description") || "").trim();
  const slug = await uniqueSlug(title);

  const course = await prisma.course.create({
    data: { title, slug, description, categoryId },
  });

  revalidatePath("/admin/courses");
  redirect(`/admin/courses/${course.id}`);
}

export async function updateCourse(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const coverImage = String(formData.get("coverImage") || "").trim() || null;
  const categoryId = await resolveCategoryId(
    formData.get("category") as string | null
  );

  await prisma.course.update({
    where: { id },
    data: { title, description, coverImage, categoryId },
  });
  revalidatePath(`/admin/courses/${id}`);
  revalidatePath("/admin/courses");
}

export async function setCourseStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  await prisma.course.update({ where: { id }, data: { status } });
  revalidatePath(`/admin/courses/${id}`);
  revalidatePath("/admin/courses");
}

export async function deleteCourse(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.course.delete({ where: { id } });
  revalidatePath("/admin/courses");
  redirect("/admin/courses");
}

// --------------------------- Sections ---------------------------

export async function addSection(formData: FormData) {
  await requireAdmin();
  const courseId = String(formData.get("courseId"));
  const title = String(formData.get("title") || "").trim() || "New section";
  const count = await prisma.section.count({ where: { courseId } });
  await prisma.section.create({ data: { courseId, title, order: count } });
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function renameSection(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const courseId = String(formData.get("courseId"));
  const title = String(formData.get("title") || "").trim();
  if (title) await prisma.section.update({ where: { id }, data: { title } });
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function deleteSection(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const courseId = String(formData.get("courseId"));
  await prisma.section.delete({ where: { id } });
  revalidatePath(`/admin/courses/${courseId}`);
}

// --------------------------- Units ---------------------------

export async function addUnit(formData: FormData) {
  await requireAdmin();
  const sectionId = String(formData.get("sectionId"));
  const courseId = String(formData.get("courseId"));
  const type = String(formData.get("type")) as UnitType;
  const title = String(formData.get("title") || "").trim() || "Untitled unit";
  const count = await prisma.unit.count({ where: { sectionId } });

  const unit = await prisma.unit.create({
    data: {
      sectionId,
      title,
      type,
      order: count,
      data: defaultUnitData(type) as Prisma.InputJsonObject,
    },
  });

  // QUIZ units get a Quiz record (built in Phase 5).
  if (type === "QUIZ") {
    await prisma.quiz.create({
      data: { unitId: unit.id, title, passScore: 70 },
    });
  }

  revalidatePath(`/admin/courses/${courseId}`);
  redirect(`/admin/courses/${courseId}/units/${unit.id}`);
}

export async function updateUnit(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const courseId = String(formData.get("courseId"));
  const title = String(formData.get("title") || "").trim();

  const unit = await prisma.unit.findUnique({ where: { id } });
  if (!unit) return;

  // Build type-specific data payload from the submitted fields.
  let data: Record<string, unknown> = {};
  switch (unit.type) {
    case "VIDEO":
      data = {
        youtubeId: extractYouTubeId(String(formData.get("youtubeId") || "")),
        durationSec: Number(formData.get("durationSec") || 0),
      };
      break;
    case "NOTES":
      data = { contentMarkdown: String(formData.get("contentMarkdown") || "") };
      break;
    case "LIVE_SESSION":
      data = {
        teamsJoinUrl: String(formData.get("teamsJoinUrl") || "").trim(),
        startsAt: String(formData.get("startsAt") || "").trim(),
        durationMin: Number(formData.get("durationMin") || 60),
        replayUrl: String(formData.get("replayUrl") || "").trim(),
      };
      break;
    case "FILE_ASSIGNMENT":
      data = {
        prompt: String(formData.get("prompt") || "").trim(),
        allowedFileTypes: String(formData.get("allowedFileTypes") || "").trim(),
      };
      break;
    case "CERTIFICATE":
      data = { templateId: String(formData.get("templateId") || "default") };
      break;
    default:
      data = (unit.data as Record<string, unknown>) ?? {};
  }

  await prisma.unit.update({
    where: { id },
    data: { title: title || unit.title, data: data as Prisma.InputJsonObject },
  });

  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/admin/courses/${courseId}/units/${id}`);
}

export async function deleteUnit(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const courseId = String(formData.get("courseId"));
  await prisma.unit.delete({ where: { id } });
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(`/admin/courses/${courseId}`);
}

/** Email all enrolled learners a reminder for a LIVE_SESSION unit. */
export async function sendLiveSessionReminders(formData: FormData) {
  await requireAdmin();
  const unitId = String(formData.get("unitId"));
  const courseId = String(formData.get("courseId"));

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { section: { include: { course: true } } },
  });
  if (!unit || unit.type !== "LIVE_SESSION") return;

  const data = (unit.data as Record<string, unknown>) ?? {};
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: unit.section.courseId },
    include: { user: true },
  });

  await Promise.all(
    enrollments
      .filter((e) => e.user.status === "APPROVED")
      .map((e) =>
        sendLiveSessionReminder(e.user.email, e.user.name, {
          courseTitle: unit.section.course.title,
          unitTitle: unit.title,
          startsAt: data.startsAt ? String(data.startsAt) : undefined,
          joinUrl: data.teamsJoinUrl ? String(data.teamsJoinUrl) : undefined,
        })
      )
  );

  revalidatePath(`/admin/courses/${courseId}/units/${unitId}`);
}

// Accept a full YouTube URL or a bare ID and normalise to the 11-char ID.
function extractYouTubeId(input: string): string {
  const s = input.trim();
  if (!s) return "";
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1];
  }
  if (/^[\w-]{11}$/.test(s)) return s;
  return s;
}
