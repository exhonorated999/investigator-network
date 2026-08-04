/**
 * Client-safe link detection for social posts. When a member pastes a link
 * (YouTube, Vimeo, Instagram, LinkedIn, X, …) into a post, we surface a rich
 * embed beneath the text:
 *   - YouTube / Vimeo  -> a responsive video iframe
 *   - everything else  -> a safe "rich link" card (platform + host + url)
 *
 * No network calls and no third-party scripts — only https URLs are trusted,
 * so a pasted `javascript:` or data URL can never produce an embed.
 */

export type LinkEmbedKind = "youtube" | "vimeo" | "link";

export interface LinkEmbed {
  kind: LinkEmbedKind;
  /** The original URL, always safe to use as an href. */
  url: string;
  /** iframe src for video kinds. */
  embedUrl?: string;
  /** Human label for the source ("YouTube", "Instagram", "LinkedIn", host…). */
  platform: string;
  /** Bare hostname, for the link card. */
  host: string;
}

const URL_RE = /https?:\/\/[^\s<>"')]+/gi;

/**
 * Tracking parameters that make a shared URL unreadable. LinkedIn's share
 * links in particular arrive with utm_*, rcm, and a tracking id attached.
 */
const STRIP_PARAMS = [
  /^utm_/i,
  /^rcm$/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^igshid$/i,
  /^mc_[ce]id$/i,
  /^trk$/i,
  /^trackingId$/i,
  /^originalSubdomain$/i,
];

/** Strip tracking parameters so a pasted link is presentable. */
export function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw);
    for (const key of [...u.searchParams.keys()]) {
      if (STRIP_PARAMS.some((re) => re.test(key))) u.searchParams.delete(key);
    }
    return u.toString().replace(/\?$/, "");
  } catch {
    return raw;
  }
}

/**
 * A short, human-readable label for a URL: host plus a trimmed path, with the
 * query string dropped. Used instead of printing a 200-character share link.
 */
export function shortUrlLabel(raw: string, max = 48): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw.length > max ? `${raw.slice(0, max - 1)}…` : raw;
  }
  const host = u.hostname.replace(/^www\./, "");
  const path = u.pathname.replace(/\/+$/, "");
  const label = path && path !== "/" ? `${host}${path}` : host;
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

/** First https(+http) URL in a block of text, or null. */
export function firstUrl(text: string): string | null {
  const m = text.match(URL_RE);
  if (!m) return null;
  // Trim trailing punctuation that commonly rides along in prose.
  return m[0].replace(/[.,;:!?]+$/, "");
}

function youtubeId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
  if (host.endsWith("youtube.com")) {
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]+)/);
    if (m) return m[2];
  }
  return null;
}

function vimeoId(u: URL): string | null {
  if (!/(^|\.)vimeo\.com$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/\/(\d+)/);
  return m ? m[1] : null;
}

const PLATFORMS: { test: RegExp; label: string }[] = [
  { test: /(^|\.)instagram\.com$/i, label: "Instagram" },
  { test: /(^|\.)linkedin\.com$/i, label: "LinkedIn" },
  { test: /(^|\.)(x|twitter)\.com$/i, label: "X" },
  { test: /(^|\.)facebook\.com$/i, label: "Facebook" },
  { test: /(^|\.)tiktok\.com$/i, label: "TikTok" },
  { test: /(^|\.)threads\.net$/i, label: "Threads" },
];

function platformLabel(host: string): string {
  return PLATFORMS.find((p) => p.test.test(host))?.label ?? host.replace(/^www\./, "");
}

/** Detect an embeddable link in a post body. Returns null when there is none. */
export function detectLinkEmbed(body: string): LinkEmbed | null {
  const raw = firstUrl(body);
  if (!raw) return null;

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;

  const host = u.hostname.replace(/^www\./, "");

  const yt = youtubeId(u);
  if (yt) {
    return {
      kind: "youtube",
      url: raw,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1`,
      platform: "YouTube",
      host,
    };
  }

  const vim = vimeoId(u);
  if (vim) {
    return {
      kind: "vimeo",
      url: raw,
      embedUrl: `https://player.vimeo.com/video/${vim}`,
      platform: "Vimeo",
      host,
    };
  }

  return { kind: "link", url: cleanUrl(raw), platform: platformLabel(host), host };
}
