import { fetchLinkPreview } from "@/lib/link-preview";

/**
 * Grant-page prefill — mirrors the newsroom's link-preview flow. We reuse the
 * OpenGraph/JSON-LD scraper for the title, summary and source, then do a light
 * best-effort scan of the page text for a closing/due date. Everything the
 * scraper can't find (notably eligibility, which usually lives in the linked
 * PDF solicitation) is left for the admin to fill in and review before
 * publishing — the fetch is a head start, not the final word.
 */

export interface GrantPreview {
  url: string;
  title: string;
  summary: string;
  /** Best guess at the granting agency (the page's site/source name). */
  grantingAgency: string;
  /** ISO date string when a closing/due date could be found, else null. */
  dueDate: string | null;
}

export type GrantPreviewResult =
  | { ok: true; preview: GrantPreview }
  | { ok: false; error: string };

const MONTHS =
  "(?:January|February|March|April|May|June|July|August|September|October|November|December)";

/** Labels that commonly precede a grant's application deadline. */
const DUE_LABELS = [
  "closing date",
  "close date",
  "application deadline",
  "applications? due",
  "deadline",
  "due date",
  "closes",
];

/**
 * Look for "<label> … <date>" in the page text. Accepts "September 30, 2026"
 * and "9/30/2026" style dates within a short window after the label.
 */
function findDueDate(text: string): string | null {
  const flat = text.replace(/\s+/g, " ");
  const datePart = `(${MONTHS}\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4})`;
  for (const label of DUE_LABELS) {
    const re = new RegExp(`${label}[^A-Za-z0-9]{0,20}${datePart}`, "i");
    const m = flat.match(re);
    if (m?.[1]) {
      const d = new Date(m[1].replace(/(\d)(st|nd|rd|th)/g, "$1"));
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  return null;
}

export async function fetchGrantPreview(url: string): Promise<GrantPreviewResult> {
  // withBody so the deadline scan has the page's paragraph text to work with.
  const res = await fetchLinkPreview(url, { withBody: true });
  if (!res.ok) return { ok: false, error: res.error };

  const p = res.preview;
  const haystack = `${p.title}\n${p.summary}\n${p.body}`;

  return {
    ok: true,
    preview: {
      url: p.url,
      title: p.title,
      summary: p.summary,
      grantingAgency: p.sourceName,
      dueDate: findDueDate(haystack),
    },
  };
}
