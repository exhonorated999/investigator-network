/**
 * Cheap reject for the bot signup shape on the pending queue: one long token
 * of mixed-case letters and no spaces, such as "NrdLQGrxBIAHtDcWyInobD".
 *
 * A value is rejected only when all of the following hold:
 * - The letters-only form is at least `GIBBERISH_MIN_LENGTH` characters.
 * - It is ASCII letters (spaces, hyphens, apostrophes, and periods are
 *   removed first). Digits, accents, and other scripts are allowed so
 *   "José García", "李伟", and "Precinct 12" are never judged here.
 * - It uses both cases, and the case flips often enough that it is not a
 *   name or agency written as glued Title Case ("LosAngelesPoliceDepartment"),
 *   camelCase, or a Mc/Mac name.
 *
 * Spaces do not bypass the check: "NrdLQGrx BIAHtDcWyInobDxxxx" is judged
 * with the spaces removed. Raise `GIBBERISH_MIN_LENGTH` if a real name is
 * rejected; lower it if a shorter copy of this bot shape shows up.
 */

export const GIBBERISH_MIN_LENGTH = 16;

/** Shown on the name field. Does not mention bots or the rule. */
export const GIBBERISH_NAME_MESSAGE = "Please enter your real name.";

/** Shown on the agency field. Empty agency stays valid. */
export const GIBBERISH_AGENCY_MESSAGE =
  "Please enter the real agency or business name, or leave it blank.";

/** Glued words: "LosAngelesPoliceDepartment", "MaryJaneWatson". */
const GLUED_TITLE_CASE = /^[A-Z][a-z]{2,}(?:[A-Z][a-z]{2,}){0,5}$/;
/** "iPhoneUserNameSomething" and similar. */
const GLUED_CAMEL_CASE = /^[a-z]+(?:[A-Z][a-z]{2,}){1,5}$/;
/** "McDonaldsInternational", "MacArthurFoundation". */
const MC_OR_MAC = /^(?:Mc|Mac)[A-Z][a-z]{2,}(?:[A-Z][a-z]{2,}){0,4}$/;

export function isGibberishLabel(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Digits, accents, and non-Latin letters are ordinary real-world input.
  if (/[^A-Za-z\s.'’\-]/.test(trimmed)) return false;

  const compact = trimmed.replace(/[\s.'’\-]/g, "");
  if (isGibberishToken(compact)) return true;

  return trimmed.split(/\s+/).some((token) => {
    return isGibberishToken(token.replace(/['’.\-]/g, ""));
  });
}

function isGibberishToken(token: string): boolean {
  if (token.length < GIBBERISH_MIN_LENGTH) return false;
  if (!/^[A-Za-z]+$/.test(token)) return false;
  if (
    GLUED_TITLE_CASE.test(token) ||
    GLUED_CAMEL_CASE.test(token) ||
    MC_OR_MAC.test(token)
  ) {
    return false;
  }

  let upper = 0;
  let lower = 0;
  let transitions = 0;
  let prevUpper: boolean | null = null;
  for (const char of token) {
    const isUpper = char >= "A" && char <= "Z";
    if (isUpper) upper++;
    else lower++;
    if (prevUpper !== null && prevUpper !== isUpper) transitions++;
    prevUpper = isUpper;
  }
  if (upper < 2 || lower < 2) return false;

  const density = transitions / token.length;
  if (transitions >= 8 && density >= 0.35) return true;

  const upperRuns = token.match(/[A-Z]+/g) ?? [];
  const longUpperRuns = upperRuns.filter((run) => run.length >= 2).length;
  return longUpperRuns >= 2 && transitions >= 6;
}
