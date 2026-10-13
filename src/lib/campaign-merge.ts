/**
 * Campaign personalization + custom-list helpers. Prisma-free and pure so it can
 * be unit-tested and safely imported anywhere.
 *
 * Merge tags (case-insensitive, whitespace tolerant):
 *   {{first_name}}            -> recipient first name, or "there" when blank
 *   {{first_name|Officer}}    -> custom fallback when blank
 *   Hello {{first_name|}},    -> "Hello Dana," / "Hello," (empty fallback drops the space)
 *   {{firstName}} / {{ first_name }} also work.
 *   {{first_name | default: "Detective"}}  Liquid/Mailchimp-style fallback works too.
 *   {{agency}} / {{department}}  -> list "Agency" column ("your agency" when blank)
 *
 * Full-HTML placeholders (only for campaigns that supply a complete email
 * document instead of using the branded shell):
 *   [UNSUBSCRIBE LINK] / {{unsubscribe_url}} / {{unsubscribe_link}}
 *   [MAILING ADDRESS]  / {{mailing_address}} / {{postal_address}}
 */

export const DEFAULT_FIRST_NAME_FALLBACK = "there";

/** One row of an uploaded one-off recipient list (stored on Campaign.customList). */
export interface ListEntry {
  email: string;
  firstName: string;
  name: string;
  /** Optional agency/department, for {{agency}}. */
  agency?: string;
}

export interface MergeVars {
  firstName?: string | null;
  agency?: string | null;
}

export const DEFAULT_AGENCY_FALLBACK = "your agency";

const tagRe = (name: string) =>
  new RegExp(`\\{\\{\\s*${name}\\s*(?:\\|\\s*([^}]*?)\\s*)?\\}\\}`, "gi");
const emptyRe = (name: string) => new RegExp(`[ \\t]?\\{\\{\\s*${name}\\s*\\|\\s*\\}\\}`, "gi");

const MERGE_FIELDS: { key: keyof MergeVars; re: RegExp; empty: RegExp; fallback: string }[] = [
  { key: "firstName", re: tagRe("first_?name"), empty: emptyRe("first_?name"), fallback: DEFAULT_FIRST_NAME_FALLBACK },
  {
    key: "agency",
    re: tagRe("(?:agency|department|agency_?name)"),
    empty: emptyRe("(?:agency|department|agency_?name)"),
    fallback: DEFAULT_AGENCY_FALLBACK,
  },
];

const FIRST_NAME_RE = MERGE_FIELDS[0].re;
const UNSUB_RE =
  /\[\s*UNSUBSCRIBE\s+LINK\s*\]|\{\{\s*unsubscribe_?(?:url|link)\s*\}\}/gi;
const ADDRESS_RE =
  /\[\s*MAILING\s+ADDRESS\s*\]|\{\{\s*(?:mailing|postal|physical)_?address\s*\}\}/gi;
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
  vars: MergeVars,
  mode: "html" | "text" = "html"
): string {
  let out = input;
  for (const f of MERGE_FIELDS) {
    const value = (vars[f.key] || "").trim();
    // An explicitly empty fallback ({{first_name|}}) drops the tag AND the space
    // before it, so "Hello {{first_name|}}," becomes "Hello," when blank.
    if (!value) out = out.replace(f.empty, "");
    out = out.replace(f.re, (_m, fallback?: string) => {
      const v = value || cleanFallback(fallback) || f.fallback;
      return mode === "html" ? escapeHtml(v) : v;
    });
  }
  return out;
}

/** `X`, `"X"`, `default: "X"`, `default: X` -> X (Liquid/Mailchimp-style tolerant). */
function cleanFallback(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .replace(/^default\s*:\s*/i, "")
    .replace(/^["'“”‘’](.*)["'“”‘’]$/, "$1")
    .trim();
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
  const titleCol = findCol(header, ["title/role", "title", "role", "rank", "position", "job title"]);
  const agencyCol = findCol(header, ["agency", "department", "agency name", "organization", "org"]);

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
    const firstName = cell(firstCol) || greetingNameFrom(name, cell(titleCol));
    if (!firstName) blankFirstName++;
    const entry: ListEntry = { email, firstName, name };
    const agency = cleanAgency(cell(agencyCol));
    if (agency) entry.agency = agency;
    entries.push(entry);
  }

  return { entries, skippedNoEmail, duplicates, blankFirstName };
}

const RANKS: [RegExp, string][] = [
  [/^(det|detective)\.?$/i, "Detective"],
  [/^(sgt|sergeant)\.?$/i, "Sergeant"],
  [/^(lt|lieut|lieutenant)\.?$/i, "Lieutenant"],
  [/^(capt|cpt|captain)\.?$/i, "Captain"],
  [/^(cpl|corporal)\.?$/i, "Corporal"],
  [/^(inv|investigator)\.?$/i, "Investigator"],
  [/^(ofc|officer)\.?$/i, "Officer"],
  [/^(dep|deputy)\.?$/i, "Deputy"],
  [/^(chief)\.?$/i, "Chief"],
  [/^(sheriff)\.?$/i, "Sheriff"],
];
const isInitial = (t: string) => /^[A-Z]\.?$/i.test(t) || /^([A-Z]\.){2,}$/i.test(t);
const SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i;

function rankFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (/lieutenant/.test(t)) return "Lieutenant";
  if (/sergeant/.test(t)) return "Sergeant";
  if (/captain/.test(t)) return "Captain";
  if (/detective/.test(t)) return "Detective";
  if (/investigator/.test(t)) return "Investigator";
  if (/chief/.test(t)) return "Chief";
  return "";
}

/**
 * Greeting name from a messy contact-name cell (+ optional title):
 *   "Dustin Baker" -> "Dustin"        "Fields, Twandy" -> "Twandy"
 *   "Det. Frias"   -> "Detective Frias"  "J. Michael Sesher" -> "Michael"
 *   "D. Robertson" + title "Detective" -> "Detective Robertson" (no title -> "")
 *   "(Investigations)" / "A / B / C" -> "" (template fallback greeting)
 */
export function greetingNameFrom(name: string | null | undefined, title = ""): string {
  let t = (name || "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (!t || /\//.test(t) || /&|\band\b/i.test(t)) return "";
  const commas = t.split(",").map((s) => s.trim()).filter(Boolean);
  if (commas.length > 2) return "";
  if (commas.length === 2) {
    if (SUFFIX.test(commas[1])) t = commas[0];
    else if (!commas[0].includes(" ")) t = `${commas[1]} ${commas[0]}`; // "Last, First"
    else return "";
  }
  let toks = t.split(" ").filter((x) => !SUFFIX.test(x));
  if (toks.length === 0) return "";
  let rank = "";
  for (const [re, label] of RANKS) {
    if (re.test(toks[0])) {
      rank = label;
      toks = toks.slice(1);
      break;
    }
  }
  if (toks.length === 0) return "";
  const last = toks[toks.length - 1];
  if (rank) return isInitial(last) ? "" : `${rank} ${last}`;
  if (!isInitial(toks[0])) return toks[0];
  // Leading initial(s): use a spelled-out middle name, else rank + surname.
  const given = toks.slice(1, -1).find((x) => !isInitial(x));
  if (given) return given;
  const r = rankFromTitle(title);
  return r && toks.length > 1 && !isInitial(last) ? `${r} ${last}` : "";
}

/** "Boaz PD" -> "Boaz Police Department"; drops "(KY)"-style parentheticals. */
export function cleanAgency(raw: string | null | undefined): string {
  return (raw || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bPD$/, "Police Department")
    .replace(/\bSO$/, "Sheriff's Office")
    .replace(/\bDPS$/, "Department of Public Safety");
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
      ...(o.agency ? { agency: String(o.agency).trim() } : {}),
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
