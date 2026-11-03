/**
 * Hidden field on the public register form. People never see or tab to it.
 * Bots that fill every input put something here. Absence is fine — a client
 * that omits the field is not treated as a bot, so the check cannot lock out
 * the form if the markup fails to render.
 */

export const HONEYPOT_FIELD = "company_url";

/** Shown when the honeypot is filled. Does not mention the field. */
export const HONEYPOT_MESSAGE =
  "We couldn't complete that registration. Please try again.";

export function honeypotFilled(value: unknown): boolean {
  if (typeof value !== "string") return value != null;
  return value.trim().length > 0;
}
