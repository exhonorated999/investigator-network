/**
 * Document / presentation embeds for NOTES units — Heyzine flipbooks, Google
 * Slides, Office Online, and friends. Admins paste whatever the provider hands
 * them (usually a whole `<iframe>` snippet); we pull the src out and normalise
 * it so the frame is responsive instead of the provider's fixed 400px.
 */

export interface EmbedRef {
  url: string;
  /** Frame height in px. 0 means "use the default for the provider". */
  height: number;
  title: string;
}

export function emptyEmbedRef(): EmbedRef {
  return { url: "", height: 0, title: "" };
}

export function parseEmbedRef(data: Record<string, unknown>): EmbedRef {
  return {
    url: String(data.embedUrl ?? "").trim(),
    height: Number(data.embedHeight ?? 0) || 0,
    title: String(data.embedTitle ?? "").trim(),
  };
}

/** Providers we recognise, for the label shown on the frame. */
const KNOWN: { test: RegExp; label: string; height: number }[] = [
  { test: /(^|\.)heyzine\.com$/i, label: "Flipbook", height: 720 },
  { test: /(^|\.)issuu\.com$/i, label: "Flipbook", height: 720 },
  { test: /(^|\.)anyflip\.com$/i, label: "Flipbook", height: 720 },
  { test: /(^|\.)flipsnack\.com$/i, label: "Flipbook", height: 720 },
  { test: /(^|\.)docs\.google\.com$/i, label: "Google Slides", height: 640 },
  { test: /(^|\.)officeapps\.live\.com$/i, label: "PowerPoint", height: 640 },
  { test: /(^|\.)sharepoint\.com$/i, label: "PowerPoint", height: 640 },
  { test: /(^|\.)onedrive\.live\.com$/i, label: "PowerPoint", height: 640 },
  { test: /(^|\.)canva\.com$/i, label: "Canva", height: 640 },
  { test: /(^|\.)scribd\.com$/i, label: "Document", height: 720 },
];

function match(url: string) {
  try {
    const host = new URL(url).hostname;
    return KNOWN.find((k) => k.test.test(host)) ?? null;
  } catch {
    return null;
  }
}

export function embedLabel(url: string): string {
  return match(url)?.label ?? "Document";
}

export function embedHeight(ref: EmbedRef): number {
  if (ref.height > 0) return ref.height;
  return match(ref.url)?.height ?? 640;
}

/**
 * Turn whatever the admin pasted into a plain embed URL.
 *
 * Accepts a full `<iframe …>` snippet, a bare URL, or a provider "share" link
 * that needs rewriting into its embed form. Returns an empty string for
 * anything that is not a plain https URL — the field is admin-only, but a
 * `javascript:` src would still be a bad day.
 */
export function parseEmbedInput(raw: string): { url: string; height: number } {
  const input = raw.trim();
  if (!input) return { url: "", height: 0 };

  const src = input.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
  let candidate = (src ?? input).trim();

  // Pull the provider's own height out of the snippet, if it set one.
  let height = 0;
  if (src) {
    const px =
      input.match(/height\s*:\s*(\d+)\s*px/i) ??
      input.match(/\bheight\s*=\s*["'](\d+)["']/i);
    // Providers habitually ship a squat 400px frame; ignore anything that
    // small and let the default win.
    const n = Number(px?.[1] ?? 0);
    if (n >= 480) height = n;
  }

  if (candidate.startsWith("//")) candidate = "https:" + candidate;
  if (!/^https:\/\//i.test(candidate)) return { url: "", height: 0 };

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { url: "", height: 0 };
  }

  // Google Slides: /edit and /pub links become /embed.
  if (/(^|\.)docs\.google\.com$/i.test(url.hostname)) {
    const id = url.pathname.match(/\/presentation\/d\/(?:e\/)?([\w-]+)/)?.[1];
    if (id && !url.pathname.endsWith("/embed")) {
      const e = url.pathname.includes("/d/e/") ? "e/" : "";
      return {
        url: `https://docs.google.com/presentation/d/${e}${id}/embed?start=false&loop=false&rm=minimal`,
        height,
      };
    }
  }

  // A bare Office file on a public host — wrap it in the Office viewer.
  if (/\.(pptx?|docx?|xlsx?)$/i.test(url.pathname) &&
      !/officeapps\.live\.com$/i.test(url.hostname)) {
    return {
      url:
        "https://view.officeapps.live.com/op/embed.aspx?src=" +
        encodeURIComponent(url.toString()),
      height,
    };
  }

  return { url: url.toString(), height };
}
