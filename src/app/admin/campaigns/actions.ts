"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { sendCampaign, sendTest } from "@/lib/campaigns";
import type { Audience } from "@/generated/prisma";

function parseAudience(raw: FormDataEntryValue | null): Audience | null {
  const s = String(raw || "").trim().toUpperCase();
  return s === "LE" || s === "CIVILIAN" ? (s as Audience) : null;
}

function refresh(id?: string) {
  revalidatePath("/admin/campaigns");
  if (id) revalidatePath(`/admin/campaigns/${id}`);
}

export async function createCampaign(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const subject = String(formData.get("subject") || "").trim();
  const bodyHtml = String(formData.get("bodyHtml") || "").trim();
  if (!subject || !bodyHtml) return;

  const c = await prisma.campaign.create({
    data: {
      subject,
      preheader: String(formData.get("preheader") || "").trim(),
      bodyHtml,
      fromName: String(formData.get("fromName") || "").trim(),
      includeMembers: formData.get("includeMembers") != null,
      includeContacts: formData.get("includeContacts") != null,
      memberAudience: parseAudience(formData.get("memberAudience")),
      createdById: session.user.id,
    },
  });
  redirect(`/admin/campaigns/${c.id}`);
}

export async function updateCampaign(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const existing = await prisma.campaign.findUnique({ where: { id }, select: { status: true } });
  if (!existing || existing.status !== "DRAFT") return; // only drafts are editable

  const subject = String(formData.get("subject") || "").trim();
  const bodyHtml = String(formData.get("bodyHtml") || "").trim();
  if (!subject || !bodyHtml) return;

  await prisma.campaign.update({
    where: { id },
    data: {
      subject,
      preheader: String(formData.get("preheader") || "").trim(),
      bodyHtml,
      fromName: String(formData.get("fromName") || "").trim(),
      includeMembers: formData.get("includeMembers") != null,
      includeContacts: formData.get("includeContacts") != null,
      memberAudience: parseAudience(formData.get("memberAudience")),
    },
  });
  refresh(id);
}

export async function deleteCampaign(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await prisma.campaign.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/campaigns");
  redirect("/admin/campaigns");
}

export async function sendTestAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const to = String(formData.get("testEmail") || "").trim();
  if (!id || !to) return;
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c) return;
  await sendTest(c, to);
  refresh(id);
}

export async function sendCampaignAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  // Guard: require an explicit typed confirmation to avoid accidental blasts.
  const confirm = String(formData.get("confirm") || "").trim().toUpperCase();
  if (!id || confirm !== "SEND") return;
  await sendCampaign(id);
  refresh(id);
}
