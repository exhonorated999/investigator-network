"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { slugify, withSuffix } from "@/lib/slug";
import { defaultUnitData } from "@/lib/units";
import { parseVideoInput, type VideoProvider } from "@/lib/video";
import { parseEmbedInput } from "@/lib/embed";
import { sendLiveSessionReminder } from "@/lib/email";
import { saveFile } from "@/lib/storage";
import type { UnitType, Prisma, Audience } from "@/generated/prisma";

/**
 * Read the two audience checkboxes (`aud_le`, `aud_civ`) into the enum array.
 * Falls back to [LE] when neither is checked so a course is never audienceless
 * (which would make it invisible to every learner).
 */
function parseAudiences(formData: FormData): Audience[] {
  const out: Audience[] = [];
  if (formData.get("aud_le") != null) out.push("LE");
  if (formData.get("aud_civ") != null) out.push("CIVILIAN");
  return out.length ? out : ["LE"];
}

/** Read the pricing radio/select into the Pricing enum. Defaults to FREE. */
function parsePricing(formData: FormData): "FREE" | "PAID" {
  return String(formData.get("pricing")).toUpperCase() === "PAID" ? "PAID" : "FREE";
}

/** Parse the optional training-hours field. Blank / invalid → null. */
function parseHours(formData: FormData): number | null {
  const raw = String(formData.get("trainingHours") || "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

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
    data: {
      title,
      slug,
      description,
      categoryId,
      audiences: parseAudiences(formData),
      isPrivate: formData.get("isPrivate") != null,
      pricing: parsePricing(formData),
    },
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
    data: {
      title,
      description,
      coverImage,
      categoryId,
      audiences: parseAudiences(formData),
      isPrivate: formData.get("isPrivate") != null,
      pricing: parsePricing(formData),
      instructor: String(formData.get("instructor") || "").trim(),
      trainingHours: parseHours(formData),
    },
  });
  revalidatePath(`/admin/courses/${id}`);
  revalidatePath("/admin/courses");
}

/** Max cover image size. Must stay below serverActions.bodySizeLimit in next.config.ts. */
const MAX_COVER_BYTES = 25 * 1024 * 1024;
const COVER_MIME = /^image\/(png|jpeg|jpg|webp|gif|avif)$/i;

/**
 * Upload a cover image and point the course at it.
 *
 * The file lands in UPLOAD_DIR via lib/storage and is served back through
 * /api/files/[id], so the stored `coverImage` stays a plain URL string — the
 * external-URL path keeps working untouched.
 */
export async function uploadCourseCover(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id"));
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) return;
  if (!COVER_MIME.test(file.type)) return;
  if (file.size > MAX_COVER_BYTES) return;

  const stored = await saveFile(file, "course-cover");
  const record = await prisma.fileUpload.create({
    data: {
      ownerUserId: session.user!.id!,
      path: stored.path,
      filename: stored.filename,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      purpose: "course-cover",
    },
  });

  await prisma.course.update({
    where: { id },
    data: { coverImage: `/api/files/${record.id}` },
  });

  revalidatePath(`/admin/courses/${id}`);
  revalidatePath("/admin/courses");
  revalidatePath("/dashboard");
}

/** Detach the cover image. Leaves the stored file alone (cheap, and undo-able). */
export async function clearCourseCover(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.course.update({ where: { id }, data: { coverImage: null } });
  revalidatePath(`/admin/courses/${id}`);
  revalidatePath("/admin/courses");
  revalidatePath("/dashboard");
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

/**
 * Move a section up or down within its course. Rewrites every sibling's
 * `order` sequentially so the list stays normalized even if historical rows
 * ended up with duplicate or gapped order values.
 */
export async function moveSection(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const courseId = String(formData.get("courseId"));
  const dir = String(formData.get("dir")) === "up" ? -1 : 1;

  const siblings = await prisma.section.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  const from = siblings.findIndex((s) => s.id === id);
  const to = from + dir;
  if (from === -1 || to < 0 || to >= siblings.length) return;

  const [moved] = siblings.splice(from, 1);
  siblings.splice(to, 0, moved);

  await prisma.$transaction(
    siblings.map((s, i) =>
      prisma.section.update({ where: { id: s.id }, data: { order: i } })
    )
  );

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
    case "VIDEO": {
      const provider: VideoProvider =
        String(formData.get("provider") || "") === "youtube"
          ? "youtube"
          : "bunny";
      const parsed = parseVideoInput(
        String(formData.get("videoRef") || ""),
        provider
      );
      data = {
        provider,
        videoId: parsed.videoId,
        libraryId:
          String(formData.get("libraryId") || "").trim() || parsed.libraryId,
        durationSec: Number(formData.get("durationSec") || 0),
      };
      break;
    }
    case "NOTES": {
      // Notes content is owned entirely by the block builder (see
      // notes-actions.ts), which writes `{ version, blocks }`. This form only
      // carries the unit title, so the existing data blob must survive
      // untouched — rebuilding it here would silently delete the document.
      data = (unit.data as Record<string, unknown>) ?? {};
      break;
    }
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

/**
 * Move a unit up or down within its section. Rewrites every sibling's `order`
 * sequentially so the list stays normalized even if historical rows ended up
 * with duplicate or gapped order values.
 */
export async function moveUnit(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const courseId = String(formData.get("courseId"));
  const sectionId = String(formData.get("sectionId"));
  const dir = String(formData.get("dir")) === "up" ? -1 : 1;

  const siblings = await prisma.unit.findMany({
    where: { sectionId },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  const from = siblings.findIndex((u) => u.id === id);
  const to = from + dir;
  if (from === -1 || to < 0 || to >= siblings.length) return;

  const [moved] = siblings.splice(from, 1);
  siblings.splice(to, 0, moved);

  await prisma.$transaction(
    siblings.map((u, i) =>
      prisma.unit.update({ where: { id: u.id }, data: { order: i } })
    )
  );

  revalidatePath(`/admin/courses/${courseId}`);
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
