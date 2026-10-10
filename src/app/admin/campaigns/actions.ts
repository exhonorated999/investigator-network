"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { sendCampaign, sendTest } from "@/lib/campaigns";
import {
  isFullHtmlDocument,
  parseCsv,
  parseRecipientRows,
} from "@/lib/campaign-merge";
import { Prisma, type Audience } from "@/generated/prisma";

const MAX_LIST_BYTES = 2 * 1024 * 1024;
const MAX_LIST_ROWS = 5000;

/** Read the first sheet (or CSV) that has an "email" header into raw rows. */
async function readListFile(file: File): Promise<unknown[][]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xlsx")) {
    const { default: readXlsxFile } = await import("read-excel-file/node");
    const sheets = await readXlsxFile(Buffer.from(await file.arrayBuffer()));
    const withEmail = sheets.find((s) =>
      (s.data[0] ?? []).some((c) => /^e-?mail/i.test(String(c ?? "").trim()))
    );
    return (withEmail ?? sheets[0])?.data ?? [];
  }
  return parseCsv(await file.text());
}

function back(id: string, msg: string): never {
  redirect(`/admin/campaigns/${id}?list=${encodeURIComponent(msg)}`);
}

/**
 * Attach a one-off recipient list (CSV or XLSX) to a DRAFT campaign. The list
 * replaces members/contacts/course targeting for this campaign only; nothing
 * is saved to the Contacts table.
 */
export async function uploadRecipientList(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const file = formData.get("file");
  if (!id) return;
  const existing = await prisma.campaign.findUnique({ where: { id }, select: { status: true } });
  if (!existing || existing.status !== "DRAFT") back(id, "Only drafts can change recipients.");
  if (!(file instanceof File) || file.size === 0) back(id, "Choose a .csv or .xlsx file.");
  if (file.size > MAX_LIST_BYTES) back(id, "File is larger than 2 MB.");

  let rows: unknown[][];
  try {
    rows = await readListFile(file);
  } catch {
    back(id, "Could not read that file. Save it as .xlsx or .csv and try again.");
  }
  const parsed = parseRecipientRows(rows);
  if (parsed.error) back(id, parsed.error);
  if (parsed.entries.length === 0) back(id, "No valid email addresses found.");
  if (parsed.entries.length > MAX_LIST_ROWS) back(id, `List exceeds ${MAX_LIST_ROWS} recipients.`);

  await prisma.campaign.update({
    where: { id },
    data: { customList: parsed.entries as unknown as Prisma.InputJsonValue },
  });
  refresh(id);
  const parts = [`Loaded ${parsed.entries.length} recipients from ${file.name}.`];
  if (parsed.skippedNoEmail) parts.push(`${parsed.skippedNoEmail} rows skipped (no email).`);
  if (parsed.duplicates) parts.push(`${parsed.duplicates} duplicates removed.`);
  if (parsed.blankFirstName) parts.push(`${parsed.blankFirstName} have no first name (greeting falls back to "there").`);
  back(id, parts.join(" "));
}

export async function clearRecipientList(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const existing = await prisma.campaign.findUnique({ where: { id }, select: { status: true } });
  if (!existing || existing.status !== "DRAFT") return;
  await prisma.campaign.update({ where: { id }, data: { customList: Prisma.DbNull } });
  refresh(id);
  back(id, "Uploaded list removed — standard audience targeting applies again.");
}

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
      fullHtml: formData.get("fullHtml") != null || isFullHtmlDocument(bodyHtml),
      includeMembers: formData.get("includeMembers") != null,
      includeContacts: formData.get("includeContacts") != null,
      memberAudience: parseAudience(formData.get("memberAudience")),
      courseId: String(formData.get("courseId") || "").trim() || null,
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
      fullHtml: formData.get("fullHtml") != null || isFullHtmlDocument(bodyHtml),
      includeMembers: formData.get("includeMembers") != null,
      includeContacts: formData.get("includeContacts") != null,
      memberAudience: parseAudience(formData.get("memberAudience")),
      courseId: String(formData.get("courseId") || "").trim() || null,
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

/**
 * Schedule a DRAFT campaign to send at a future time. `scheduledAt` arrives as
 * an ISO-8601 UTC string (the client converts the datetime-local using the
 * browser timezone). Requires the same typed SEND confirmation as an immediate
 * blast. Window: must be in the future and within Resend's 30-day horizon.
 */
export async function scheduleCampaign(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const confirm = String(formData.get("confirm") || "").trim().toUpperCase();
  const iso = String(formData.get("scheduledAt") || "").trim();
  if (!id || confirm !== "SEND" || !iso) return;

  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return;
  const now = Date.now();
  // Reject past times (allow a 1-minute grace) and anything > 30 days out.
  if (when.getTime() < now - 60_000) return;
  if (when.getTime() > now + 30 * 24 * 60 * 60 * 1000) return;

  const existing = await prisma.campaign.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!existing || existing.status !== "DRAFT") return; // only drafts can be scheduled

  await prisma.campaign.update({
    where: { id },
    data: { status: "SCHEDULED", scheduledAt: when },
  });
  refresh(id);
}

/** Cancel a pending schedule, returning the campaign to editable DRAFT. */
export async function unscheduleCampaign(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const existing = await prisma.campaign.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!existing || existing.status !== "SCHEDULED") return;

  await prisma.campaign.update({
    where: { id },
    data: { status: "DRAFT", scheduledAt: null },
  });
  refresh(id);
}
