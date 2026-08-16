"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";

/** Minimal RFC-4180-ish CSV parser: handles quotes, escaped quotes, CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, ""); // strip BOM
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignore; handled by \n
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function findCol(header: string[], names: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const n of names) {
    const i = lower.indexOf(n);
    if (i !== -1) return i;
  }
  return -1;
}

export interface ImportResult {
  imported: number;
  updated: number;
  skippedMembers: number;
  invalid: number;
  duplicatesInFile: number;
  total: number;
}

/**
 * Import non-member contacts from a CSV. Detects email/name/company columns by
 * header; falls back to "first column is email" when headerless. Dedupes within
 * the file and against existing members (member emails are skipped — they'll
 * receive campaigns as members). Existing contacts are updated, not duplicated.
 */
export async function importContacts(formData: FormData): Promise<void> {
  await requireAdmin();
  const file = formData.get("file");
  const source = String(formData.get("source") || "").trim() || "csv-import";
  if (!(file instanceof File) || file.size === 0) return;

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) return;

  // Header detection: if the first row contains an email cell, treat as data.
  let header = rows[0];
  let dataRows = rows.slice(1);
  let emailCol = findCol(header, ["email", "e-mail", "email address"]);
  let nameCol = findCol(header, ["name", "full name", "fullname", "first name"]);
  let companyCol = findCol(header, ["company", "organization", "organisation", "agency"]);
  if (emailCol === -1) {
    // No recognizable header — assume col0 email, col1 name, col2 company.
    if (header.some((c) => EMAIL_RE.test(c.trim()))) {
      dataRows = rows; // first row is data
    }
    emailCol = 0;
    nameCol = header.length > 1 ? 1 : -1;
    companyCol = header.length > 2 ? 2 : -1;
  }

  const seen = new Set<string>();
  const result: ImportResult = {
    imported: 0,
    updated: 0,
    skippedMembers: 0,
    invalid: 0,
    duplicatesInFile: 0,
    total: dataRows.length,
  };

  // Preload member emails for dedupe.
  const memberEmails = new Set(
    (await prisma.user.findMany({ select: { email: true } })).map((u) =>
      u.email.trim().toLowerCase()
    )
  );

  for (const r of dataRows) {
    const email = (r[emailCol] ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      result.invalid++;
      continue;
    }
    if (seen.has(email)) {
      result.duplicatesInFile++;
      continue;
    }
    seen.add(email);
    if (memberEmails.has(email)) {
      result.skippedMembers++;
      continue;
    }
    const name = nameCol >= 0 ? (r[nameCol] ?? "").trim() : "";
    const company = companyCol >= 0 ? (r[companyCol] ?? "").trim() : "";

    const existing = await prisma.contact.findUnique({ where: { email } });
    if (existing) {
      await prisma.contact.update({
        where: { email },
        data: {
          name: name || existing.name,
          company: company || existing.company,
        },
      });
      result.updated++;
    } else {
      await prisma.contact.create({
        data: { email, name, company, source },
      });
      result.imported++;
    }
  }

  revalidatePath("/admin/contacts");
}

export async function addContact(formData: FormData): Promise<void> {
  await requireAdmin();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return;
  const name = String(formData.get("name") || "").trim();
  const company = String(formData.get("company") || "").trim();
  await prisma.contact.upsert({
    where: { email },
    create: { email, name, company, source: "manual" },
    update: { name: name || undefined, company: company || undefined },
  });
  revalidatePath("/admin/contacts");
}

export async function deleteContact(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await prisma.contact.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/contacts");
}

export async function setContactStatus(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  const allowed = ["SUBSCRIBED", "UNSUBSCRIBED", "BOUNCED", "COMPLAINED"];
  if (!id || !allowed.includes(status)) return;
  await prisma.contact.update({
    where: { id },
    data: { status: status as "SUBSCRIBED" | "UNSUBSCRIBED" | "BOUNCED" | "COMPLAINED" },
  });
  revalidatePath("/admin/contacts");
}
