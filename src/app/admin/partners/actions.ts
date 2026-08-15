"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { saveFile } from "@/lib/storage";
import type { PartnerTier } from "@/generated/prisma";

function refresh() {
  revalidatePath("/admin/partners");
  revalidatePath("/dashboard");
  revalidatePath("/partners");
}

function parseTier(raw: FormDataEntryValue | null): PartnerTier {
  return String(raw || "").trim().toUpperCase() === "FEATURED"
    ? "FEATURED"
    : "STANDARD";
}

function parseAudience(raw: FormDataEntryValue | null): "LE" | "CIVILIAN" | null {
  const s = String(raw || "").trim().toUpperCase();
  return s === "LE" || s === "CIVILIAN" ? s : null;
}

function normalizeUrl(raw: FormDataEntryValue | null): string {
  let s = String(raw || "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s;
}

/** Persist an uploaded logo (if any) and return its FileUpload id, else null. */
async function saveLogo(
  file: FormDataEntryValue | null,
  ownerUserId: string
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  const stored = await saveFile(file, "partner-logo");
  const rec = await prisma.fileUpload.create({
    data: {
      ownerUserId,
      path: stored.path,
      filename: stored.filename,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      purpose: "partner-logo",
    },
  });
  return rec.id;
}

export async function createPartner(formData: FormData) {
  const session = await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const url = normalizeUrl(formData.get("url"));
  if (!name || !url) return;

  const logoFileId = await saveLogo(formData.get("logo"), session.user.id);

  await prisma.partner.create({
    data: {
      name,
      url,
      blurb: String(formData.get("blurb") || "").trim(),
      tier: parseTier(formData.get("tier")),
      audience: parseAudience(formData.get("audience")),
      active: formData.get("active") != null,
      sortOrder: Number(formData.get("sortOrder") || 0) || 0,
      logoFileId,
    },
  });
  refresh();
}

export async function updatePartner(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const name = String(formData.get("name") || "").trim();
  const url = normalizeUrl(formData.get("url"));
  if (!name || !url) return;

  // Only replace the logo when a new file is supplied.
  const newLogoId = await saveLogo(formData.get("logo"), session.user.id);

  await prisma.partner.update({
    where: { id },
    data: {
      name,
      url,
      blurb: String(formData.get("blurb") || "").trim(),
      tier: parseTier(formData.get("tier")),
      audience: parseAudience(formData.get("audience")),
      active: formData.get("active") != null,
      sortOrder: Number(formData.get("sortOrder") || 0) || 0,
      ...(newLogoId ? { logoFileId: newLogoId } : {}),
    },
  });
  refresh();
}

export async function togglePartnerActive(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const p = await prisma.partner.findUnique({ where: { id }, select: { active: true } });
  if (!p) return;
  await prisma.partner.update({ where: { id }, data: { active: !p.active } });
  refresh();
}

export async function deletePartner(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await prisma.partner.delete({ where: { id } });
  refresh();
}
