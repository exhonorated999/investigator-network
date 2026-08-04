"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";

function refresh() {
  revalidatePath("/admin/conferences");
  revalidatePath("/dashboard");
}

function parseDate(raw: FormDataEntryValue | null): Date | undefined {
  const s = String(raw || "").trim();
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseAudience(raw: FormDataEntryValue | null): "LE" | "CIVILIAN" | null {
  const s = String(raw || "").trim().toUpperCase();
  return s === "LE" || s === "CIVILIAN" ? s : null;
}

export async function createConference(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const startsAt = parseDate(formData.get("startsAt"));
  if (!name || !startsAt) return;

  await prisma.conference.create({
    data: {
      name,
      startsAt,
      endsAt: parseDate(formData.get("endsAt")) ?? null,
      location: String(formData.get("location") || "").trim(),
      about: String(formData.get("about") || "").trim(),
      url: String(formData.get("url") || "").trim(),
      audience: parseAudience(formData.get("audience")),
    },
  });
  refresh();
}

export async function deleteConference(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  if (!id) return;
  await prisma.conference.delete({ where: { id } });
  refresh();
}
