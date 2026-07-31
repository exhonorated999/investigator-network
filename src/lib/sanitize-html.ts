/**
 * Allowlist-based HTML sanitizer using cheerio.
 *
 * Strips dangerous elements and attributes from admin-authored raw HTML blocks
 * before rendering with dangerouslySetInnerHTML. This is defense-in-depth —
 * blocks are admin-only, but a pasted `javascript:` URL or an `<iframe>` to a
 * phishing page should not survive.
 */
import * as cheerio from "cheerio";

/** Elements that are removed entirely (tag + contents). */
const STRIP_TAGS = new Set([
  "script",
  "style",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "applet",
  "meta",
  "link",
  "base",
]);

/**
 * Sanitize an HTML string. Returns an empty string for falsy input.
 *
 * Rules:
 * - Remove every element in STRIP_TAGS along with its children.
 * - Strip all `on*` event-handler attributes.
 * - On `href` and `src`, allow only `https:`, same-origin `/` paths, and
 *   `mailto:`. Everything else is blanked (the attribute is removed).
 * - `<iframe>` is allowed but only with an `https` src; any other src is
 *   removed (which effectively hides it).
 */
export function sanitizeHtml(raw: string): string {
  const html = String(raw ?? "").trim();
  if (!html) return "";

  const $ = cheerio.load(html, null, false);

  // Remove dangerous tags entirely.
  for (const tag of STRIP_TAGS) {
    $(tag).remove();
  }

  // Walk every element.
  $("*").each((_, el) => {
    if (el.type !== "tag") return;
    const attribs = el.attribs;
    if (!attribs) return;

    // Strip on* handlers and any attribute whose name starts with "on".
    for (const name of Object.keys(attribs)) {
      if (/^on/i.test(name)) {
        delete attribs[name];
      }
    }

    // Validate href / src.
    const href = attribs.href;
    if (href !== undefined) {
      if (!isSafeUrl(href)) delete attribs.href;
    }
    const src = attribs.src;
    if (src !== undefined) {
      if (!isSafeUrl(src)) {
        delete attribs.src;
      } else if (el.tagName === "iframe" && !/^https:\/\//i.test(src)) {
        // iframes must use https specifically.
        delete attribs.src;
      }
    }

    // Remove `srcset` if any entry is unsafe — simpler to just drop it.
    if (attribs.srcset !== undefined) {
      delete attribs.srcset;
    }
  });

  return $.html();
}

/** True for https, same-origin path, or mailto. */
function isSafeUrl(url: string): boolean {
  const s = String(url ?? "").trim();
  if (!s) return false;
  if (s.startsWith("/")) return true;
  if (/^https:\/\//i.test(s)) return true;
  if (/^mailto:/i.test(s)) return true;
  return false;
}
