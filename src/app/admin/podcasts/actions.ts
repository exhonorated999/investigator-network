"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { saveFile } from "@/lib/storage";
import { normalizeCategory } from "@/lib/podcasts";

function refresh() {
  revalidatePath("/admin/podcasts");
  revalidatePath("/dashboard");
  revalidatePath("/podcasts");
}

function parseAudience(raw: FormDataEntryValue | null): "LE" | "CIVILIAN" | null {
  const s = String(raw || "").trim().toUpperCase();
  return s === "LE" || s === "CIVILIAN" ? s : null;
}

/** Ruling link: optional; https-prefix bare hosts, leave blanks null. */
function normalizeUrl(raw: FormDataEntryValue | null): string | null {
  let s = String(raw || "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s;
}

/** Persist an uploaded audio file and return its FileUpload id, else null. */
async function saveAudio(
  file: FormDataEntryValue | null,
  ownerUserId: string
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  const stored = await saveFile(file, "podcast-audio");
  const rec = await prisma.fileUpload.create({
    data: {
      ownerUserId,
      path: stored.path,
      filename: stored.filename,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      purpose: "podcast-audio",
    },
  });
  return rec.id;
}

export async function createPodcast(formData: FormData) {
  const session = await requireAdmin();
  const title = String(formData.get("title") || "").trim();
  if (!title) return;

  const audioFileId = await saveAudio(formData.get("audio"), session.user.id);
  // Audio is required to create an episode.
  if (!audioFileId) return;

  await prisma.podcast.create({
    data: {
      title,
      description: String(formData.get("description") || "").trim(),
      category: normalizeCategory(String(formData.get("category") || "")),
      audioFileId,
      rulingUrl: normalizeUrl(formData.get("rulingUrl")),
      audience: parseAudience(formData.get("audience")),
      active: formData.get("active") != null,
      sortOrder: Number(formData.get("sortOrder") || 0) || 0,
    },
  });
  refresh();
}

export async function updatePodcast(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const title = String(formData.get("title") || "").trim();
  if (!title) return;

  // Only replace the audio when a new file is supplied.
  const newAudioId = await saveAudio(formData.get("audio"), session.user.id);

  await prisma.podcast.update({
    where: { id },
    data: {
      title,
      description: String(formData.get("description") || "").trim(),
      category: normalizeCategory(String(formData.get("category") || "")),
      rulingUrl: normalizeUrl(formData.get("rulingUrl")),
      audience: parseAudience(formData.get("audience")),
      active: formData.get("active") != null,
      sortOrder: Number(formData.get("sortOrder") || 0) || 0,
      ...(newAudioId ? { audioFileId: newAudioId } : {}),
    },
  });
  refresh();
}

export async function togglePodcastActive(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const p = await prisma.podcast.findUnique({ where: { id }, select: { active: true } });
  if (!p) return;
  await prisma.podcast.update({ where: { id }, data: { active: !p.active } });
  refresh();
}

export async function deletePodcast(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await prisma.podcast.delete({ where: { id } });
  refresh();
}
