"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import type { ResourceCategory } from "@/generated/prisma";

function refresh() {
  revalidatePath("/admin/resources");
  revalidatePath("/dashboard");
}

function parseCategory(raw: FormDataEntryValue | null): ResourceCategory | null {
  const s = String(raw || "").trim().toUpperCase();
  return s === "DFIR" || s === "INVESTIGATIONS" || s === "ICAC" ? s : null;
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

export async function createResource(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const url = normalizeUrl(formData.get("url"));
  const category = parseCategory(formData.get("category"));
  if (!name || !url || !category) return;

  await prisma.resource.create({
    data: {
      name,
      url,
      category,
      description: String(formData.get("description") || "").trim(),
      audience: parseAudience(formData.get("audience")),
      sortOrder: Number(formData.get("sortOrder") || 0) || 0,
    },
  });
  refresh();
}

export async function deleteResource(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  if (!id) return;
  await prisma.resource.delete({ where: { id } });
  refresh();
}
