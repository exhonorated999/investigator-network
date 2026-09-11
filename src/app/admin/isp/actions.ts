"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";

function refresh() {
  revalidatePath("/admin/isp");
  revalidatePath("/dashboard");
}

/** Accept a URL or a mailto-style email; normalize a bare domain to https://. */
function normalizeUrl(raw: FormDataEntryValue | null): string {
  let s = String(raw || "").trim();
  if (!s) return "";
  if (/^mailto:/i.test(s)) return s;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s;
}

export async function createIspProvider(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await prisma.ispProvider.create({
    data: {
      name,
      url: normalizeUrl(formData.get("url")),
      email: String(formData.get("email") || "").trim(),
      note: String(formData.get("note") || "").trim(),
    },
  });
  refresh();
}

export async function updateIspProvider(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) return;
  await prisma.ispProvider.update({
    where: { id },
    data: {
      name,
      url: normalizeUrl(formData.get("url")),
      email: String(formData.get("email") || "").trim(),
      note: String(formData.get("note") || "").trim(),
    },
  });
  refresh();
}

export async function deleteIspProvider(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  if (!id) return;
  await prisma.ispProvider.delete({ where: { id } });
  refresh();
}
