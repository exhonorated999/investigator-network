"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { fetchGrantPreview, type GrantPreviewResult } from "@/lib/grant-preview";
import { GRANT_CATEGORIES } from "@/lib/grants";
import type { GrantCategory } from "@/generated/prisma";

/**
 * Scrape a pasted grant URL so the composer can fill itself in — admin-only
 * because it makes an outbound request on the server's behalf.
 */
export async function previewGrant(url: string): Promise<GrantPreviewResult> {
  await requireAdmin();
  return fetchGrantPreview(url);
}

function refresh(id?: string) {
  revalidatePath("/admin/grants");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/admin/grants`);
}

function normalizeUrl(raw: FormDataEntryValue | null): string {
  let s = String(raw || "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s;
}

function parseDate(raw: FormDataEntryValue | null): Date | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Read the ticked category checkboxes, keeping only valid enum values. */
function parseCategories(formData: FormData): GrantCategory[] {
  const set = new Set(GRANT_CATEGORIES);
  return formData
    .getAll("categories")
    .map((v) => String(v))
    .filter((v): v is GrantCategory => set.has(v as GrantCategory));
}

function fields(formData: FormData) {
  return {
    title: String(formData.get("title") || "").trim(),
    summary: String(formData.get("summary") || "").trim(),
    url: normalizeUrl(formData.get("url")),
    grantingAgency: String(formData.get("grantingAgency") || "").trim(),
    qualifyingAgency: String(formData.get("qualifyingAgency") || "").trim(),
    dueDate: parseDate(formData.get("dueDate")),
    categories: parseCategories(formData),
    published: formData.get("published") != null,
  };
}

export async function createGrant(formData: FormData) {
  await requireAdmin();
  const f = fields(formData);
  if (!f.title || !f.url) return;
  await prisma.grant.create({ data: f });
  refresh();
  redirect("/admin/grants");
}

export async function updateGrant(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const f = fields(formData);
  if (!id || !f.title || !f.url) return;
  await prisma.grant.update({ where: { id }, data: f });
  refresh(id);
}

export async function toggleGrantPublished(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const grant = await prisma.grant.findUnique({ where: { id } });
  if (!grant) return;
  await prisma.grant.update({
    where: { id },
    data: { published: !grant.published },
  });
  refresh(id);
}

export async function deleteGrant(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  if (!id) return;
  await prisma.grant.delete({ where: { id } });
  refresh();
}
