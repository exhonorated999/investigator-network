/**
 * Campaign personalization + custom-list helpers. Prisma-free and pure so it can
 * be unit-tested and safely imported anywhere.
 *
 * Merge tags (case-insensitive, whitespace tolerant):
 *   {{first_name}}            -> recipient first name, or "there" when blank
 *   {{first_name|Officer}}    -> custom fallback when blank
 *   {{firstName}} / {{ first_name }} also work.
 *
 * Full-HTML placeholders (only for campaigns that supply a complete email
 * document instead of using the branded shell):
 *   [UNSUBSCRIBE LINK] / {{unsubscribe_url}}  -> per-recipient unsubscribe URL
 *   [MAILING ADDRESS]  / {{mailing_address}}  -> physical mailing address
 */

export const DEFAULT_FIRST_NAME_FALLBACK = "there";

/** One row of an uploaded one-off recipient list (stored on Campaign.customList). */
export interface ListEntry {
  email: string;
  firstName: string;
  name: string;
}

const FIRST_NAME_RE = /\{\{\s*first_?name\s*(?:\|\s*([^}]*?)\s*)?\}\}/gi;
const UNSUB_RE = /\[\s*UNSUBSCRIBE\s+LINK\s*\]|\{\{\s*unsubscribe_?url\s*\}\}/gi;
const ADDRESS_RE = /\[\s*MAILING\s+ADDRESS\s*\]|\{\{\s*mailing_?address\s*\}\}/gi;
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Best-effort first name from a full name ("Dana K. Smith" -> "Dana"). */
export function firstNameFrom(name: string | null | undefined): string {
  const t = (name || "").trim();
  if (!t) return "";
  return t.split(/\s+/)[0];
}

export function hasMergeTags(s: string): boolean {
  FIRST_NAME_RE.lastIndex = 0;
  return FIRST_NAME_RE.test(s);
}

/** True when the HTML is a complete document (has its own <html>/<body>). */
export function isFullHtmlDocument(html: string): boolean {
  return /<html[\s>]/i.test(html) || /<body[\s>]/i.test(html);
}

/**
 * Replace first-name merge tags. `mode: "html"` escapes the inserted value;
 * `"text"` inserts it raw (subject lines, plain-text part).
 */
export function applyMerge(
  input: string,
  vars: { firstName?: string | null },
  mode: "html" | "text" = "html"
): string {
  const first = (vars.firstName || "").trim();
  return input.replace(FIRST_NAME_RE, (_m, fallback?: string) => {
    const value = first || (fallback ?? "").trim() || DEFAULT_FIRST_NAME_FALLBACK;
    return mode === "html" ? escapeHtml(value) : value;
  });
}

/**
 * Fill compliance placeholders in a full-HTML campaign. If the document has no
 * unsubscribe placeholder at all, a minimal compliant footer is injected before
 * </body> so a send can never go out without a working unsubscribe link.
 */
export function fillFullHtml(
  html: string,
  opts: { unsubscribeUrl: string; address: string }
): string {
  UNSUB_RE.lastIndex = 0;
  const hadUnsub = UNSUB_RE.test(html);
  let out = html
    .replace(UNSUB_RE, escapeHtml(opts.unsubscribeUrl))
    .replace(ADDRESS_RE, escapeHtml(opts.address));
  if (!hadUnsub) {
    const footer =
      `<div style="padding:16px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#888;">` +
      `${escapeHtml(opts.address)} &middot; ` +
      `<a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#888;text-decoration:underline;">Unsubscribe</a></div>`;
    out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${footer}</body>`) : out + footer;
  }
  return out;
}

/** Does a full-HTML document contain an unsubscribe placeholder? */
export function hasUnsubscribePlaceholder(html: string): boolean {
  UNSUB_RE.lastIndex = 0;
  return UNSUB_RE.test(html);
}

function norm(h: unknown): string {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ");
}

function findCol(header: string[], names: string[]): number {
  for (const n of names) {
    const i = header.indexOf(n);
    if (i !== -1) return i;
  }
  return -1;
}

export interface ParsedList {
  entries: ListEntry[];
  /** Rows with no or malformed email (skipped). */
  skippedNoEmail: number;
  duplicates: number;
  /** Entries whose first name is blank (will get the fallback greeting). */
  blankFirstName: number;
  error?: string;
}

/**
 * Turn spreadsheet/CSV rows (first row = header) into a deduped recipient list.
 * Recognized headers: email | e-mail | email address; first_name | first name |
 * firstname | first; contact_name | name | full name. When there is no first
 * name column, the first word of the name column is used.
 */
export function parseRecipientRows(rows: unknown[][]): ParsedList {
  const empty: ParsedList = { entries: [], skippedNoEmail: 0, duplicates: 0, blankFirstName: 0 };
  if (rows.length === 0) return { ...empty, error: "The file is empty." };

  const header = rows[0].map(norm);
  const emailCol = findCol(header, ["email", "e mail", "email address", "emailaddress"]);
  if (emailCol === -1) {
    return { ...empty, error: "No 'email' column found in the header row." };
  }
  const firstCol = findCol(header, ["first name", "firstname", "first", "given name"]);
  const nameCol = findCol(header, ["contact name", "name", "full name", "fullname"]);

  const seen = new Set<string>();
  const entries: ListEntry[] = [];
  let skippedNoEmail = 0;
  let duplicates = 0;
  let blankFirstName = 0;

  for (const r of rows.slice(1)) {
    const cell = (i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");
    const email = cell(emailCol).toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      if (r.some((c) => String(c ?? "").trim() !== "")) skippedNoEmail++;
      continue;
    }
    if (seen.has(email)) {
      duplicates++;
      continue;
    }
    seen.add(email);
    const name = cell(nameCol);
    const firstName = cell(firstCol) || firstNameFrom(name);
    if (!firstName) blankFirstName++;
    entries.push({ email, firstName, name });
  }

  return { entries, skippedNoEmail, duplicates, blankFirstName };
}

/** Narrow the Json column back into entries (defensive against bad data). */
export function readCustomList(raw: unknown): ListEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ListEntry[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const email = String(o.email ?? "").trim().toLowerCase();
    if (!email) continue;
    out.push({
      email,
      firstName: String(o.firstName ?? "").trim(),
      name: String(o.name ?? "").trim(),
    });
  }
  return out;
}

/** Minimal RFC-4180-ish CSV parser: quotes, escaped quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
