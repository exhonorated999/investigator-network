/**
 * Public-signup email policy (server-only).
 *
 * Called from the register action before a user row is created. Two independent
 * rejects:
 *
 * 1. Disposable / throwaway domains, from the `disposable-email-domains` list
 *    (exact matches plus wildcard suffixes such as `*.33mail.com`). Refresh the
 *    list with `npm update disposable-email-domains`.
 * 2. Dotted-Gmail bot signups. Gmail ignores dots, and spam tools exploit that
 *    by slicing a local-part into many short random chunks. Normal addresses
 *    such as `jane.doe@gmail.com` stay allowed — only `gmail.com` and
 *    `googlemail.com` are inspected, and only when the local-part (ignoring a
 *    `+tag`) matches either tunable signal below.
 *
 * Agency domains (`.gov`, `.mil`, and the same with a two-letter country
 * suffix such as `.gov.uk`) skip the disposable list so a list entry can never
 * block a government address.
 */

import exactDomains from "disposable-email-domains";
import wildcardDomains from "disposable-email-domains/wildcard.json";

/** Shown on the email field. Does not reveal which check failed. */
export const SIGNUP_EMAIL_REJECTION_MESSAGE =
  "This email address can't be used to register. Use your agency email or a regular personal address.";

/**
 * Dotted-Gmail heuristic. Raise either constant if a real address is rejected;
 * lower one if a new bot shape is slipping through with fewer breaks.
 *
 * An address is rejected when its local-part has either:
 * - at least `DOTTED_GMAIL_MIN_DOTS` dots (default 4), or
 * - at least `DOTTED_GMAIL_MIN_SHORT_SEGMENTS` segments of 1–2 characters
 *   (default 4).
 *
 * `jane.doe@gmail.com` has one dot and no short segments, so it passes.
 * `w.ujona.k3.8.9@gmail.com` has four dots, so it fails.
 * `a.b.c.d@gmail.com` has only three dots but four 1-character segments, so
 * the short-segment rule fails it.
 */
export const DOTTED_GMAIL_MIN_DOTS = 4;
export const DOTTED_GMAIL_MIN_SHORT_SEGMENTS = 4;
export const DOTTED_GMAIL_SHORT_SEGMENT_MAX_LENGTH = 2;

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/** `.gov` / `.mil`, including country forms such as `.gov.uk` and `.mil.au`. */
const AGENCY_DOMAIN =
  /(?:^|\.)(?:gov|mil)(?:\.[a-z]{2})?$/i;

export type SignupEmailBlockReason = "disposable" | "dotted-gmail";

const exactDisposable = toDomainSet(exactDomains);
const wildcardDisposable = toDomainSet(wildcardDomains);

function toDomainSet(domains: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const domain of domains) {
    const normalized = domain.trim().toLowerCase();
    if (normalized) set.add(normalized);
  }
  return set;
}

function domainSuffixes(domain: string): string[] {
  const labels = domain.split(".").filter(Boolean);
  const suffixes: string[] = [];
  for (let i = 0; i < labels.length; i++) {
    suffixes.push(labels.slice(i).join("."));
  }
  return suffixes;
}

function isAgencyDomain(domain: string): boolean {
  return AGENCY_DOMAIN.test(domain);
}

function isDisposableDomain(domain: string): boolean {
  if (isAgencyDomain(domain)) return false;
  for (const suffix of domainSuffixes(domain)) {
    if (exactDisposable.has(suffix) || wildcardDisposable.has(suffix)) {
      return true;
    }
  }
  return false;
}

/**
 * Gmail local-part used for the bot fingerprint. A `+tag` is ignored because
 * Gmail delivers it to the same mailbox and bots append tags to vary signups.
 */
function gmailLocalPart(local: string): string {
  const plus = local.indexOf("+");
  return plus === -1 ? local : local.slice(0, plus);
}

function isDottedGmailBot(local: string): boolean {
  const base = gmailLocalPart(local);
  if (!base) return false;

  const segments = base.split(".");
  const dots = segments.length - 1;
  if (dots >= DOTTED_GMAIL_MIN_DOTS) return true;

  let shortSegments = 0;
  for (const segment of segments) {
    if (
      segment.length > 0 &&
      segment.length <= DOTTED_GMAIL_SHORT_SEGMENT_MAX_LENGTH
    ) {
      shortSegments++;
    }
  }
  return shortSegments >= DOTTED_GMAIL_MIN_SHORT_SEGMENTS;
}

/**
 * Returns why this address must not be registered, or null when it may proceed
 * to the existing approval flow. Malformed input returns null; format errors
 * belong to the register schema.
 */
export function signupEmailBlockReason(
  email: string
): SignupEmailBlockReason | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;

  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!local || !domain || domain.includes("@")) return null;

  if (isDisposableDomain(domain)) return "disposable";
  if (GMAIL_DOMAINS.has(domain) && isDottedGmailBot(local)) return "dotted-gmail";
  return null;
}
