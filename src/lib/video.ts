import { createHash } from "node:crypto";

/**
 * Video units used to store `{ youtubeId, durationSec }`. They now store
 * `{ provider, videoId, libraryId?, durationSec }` so the host can change
 * without a rewrite. Legacy rows are read transparently — see `parseVideoRef`.
 */
export type VideoProvider = "bunny" | "youtube";

export interface VideoRef {
  provider: VideoProvider;
  /** Bunny: the video GUID. YouTube: the 11-character id. */
  videoId: string;
  /** Bunny only. Falls back to BUNNY_STREAM_LIBRARY_ID when blank. */
  libraryId: string;
  durationSec: number;
}

export const VIDEO_PROVIDERS: { value: VideoProvider; label: string }[] = [
  { value: "bunny", label: "Bunny Stream" },
  { value: "youtube", label: "YouTube" },
];

/** Provider used for new units when the admin does not pick one. */
export const DEFAULT_PROVIDER: VideoProvider = "bunny";

export function emptyVideoRef(): VideoRef {
  return { provider: DEFAULT_PROVIDER, videoId: "", libraryId: "", durationSec: 0 };
}

/** Read a unit's `data` blob, tolerating the pre-Bunny `youtubeId` shape. */
export function parseVideoRef(data: Record<string, unknown>): VideoRef {
  const legacy = String(data.youtubeId ?? "").trim();
  const provider = String(data.provider ?? "").trim().toLowerCase();
  const videoId = String(data.videoId ?? "").trim();
  const durationSec = Number(data.durationSec ?? 0) || 0;

  if (!videoId && legacy) {
    return { provider: "youtube", videoId: legacy, libraryId: "", durationSec };
  }

  return {
    provider: provider === "youtube" ? "youtube" : "bunny",
    videoId,
    libraryId: String(data.libraryId ?? "").trim(),
    durationSec,
  };
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
/** Bunny video GUIDs are standard UUIDs. */
const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Pull an id out of whatever the admin pasted — a share URL, an embed URL, an
 * iframe snippet, or a bare id. Returns the library id too when the pasted
 * Bunny URL carries one, so a second Stream library still works.
 */
export function parseVideoInput(
  raw: string,
  provider: VideoProvider
): { videoId: string; libraryId: string } {
  const input = raw.trim();
  if (!input) return { videoId: "", libraryId: "" };

  // An iframe snippet — dig the src out first.
  const src = input.match(/src\s*=\s*["']([^"']+)["']/i)?.[1];
  const text = src ?? input;

  if (provider === "bunny") {
    // https://iframe.mediadelivery.net/{embed|play}/{libraryId}/{guid}
    const pair = text.match(/\/(?:embed|play)\/(\d+)\/([0-9a-f-]{36})/i);
    if (pair) return { libraryId: pair[1], videoId: pair[2].toLowerCase() };
    const guid = text.match(GUID);
    if (guid) return { libraryId: "", videoId: guid[0].toLowerCase() };
    return { libraryId: "", videoId: "" };
  }

  if (YT_ID.test(text)) return { videoId: text, libraryId: "" };
  const yt =
    text.match(/[?&]v=([A-Za-z0-9_-]{11})/) ??
    text.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ??
    text.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
  return { videoId: yt?.[1] ?? "", libraryId: "" };
}

/**
 * Bunny signs embeds as sha256(tokenKey + videoId + expiry). Without a key
 * configured the embed still plays; lock the Stream library to your own
 * domain via referrer restriction in that case.
 */
function signBunny(videoId: string): string {
  const key = process.env.BUNNY_STREAM_TOKEN_KEY?.trim();
  if (!key) return "";
  const ttl = Number(process.env.BUNNY_STREAM_TOKEN_TTL || 14400) || 14400;
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const token = createHash("sha256")
    .update(key + videoId + expires)
    .digest("hex");
  return `&token=${token}&expires=${expires}`;
}

export interface VideoEmbed {
  src: string;
  /** Shown to the admin/learner when playback cannot be built. */
  provider: VideoProvider;
}

/**
 * Build the iframe URL for a unit. Returns null when the unit has no video
 * yet, or when Bunny is selected but the library id is not configured.
 */
export function videoEmbed(ref: VideoRef): VideoEmbed | null {
  if (!ref.videoId) return null;

  if (ref.provider === "youtube") {
    return {
      provider: "youtube",
      src: `https://www.youtube-nocookie.com/embed/${ref.videoId}?rel=0&modestbranding=1`,
    };
  }

  const library = ref.libraryId || process.env.BUNNY_STREAM_LIBRARY_ID?.trim();
  if (!library) return null;

  return {
    provider: "bunny",
    src:
      `https://iframe.mediadelivery.net/embed/${library}/${ref.videoId}` +
      `?autoplay=false&preload=false&responsive=true` +
      signBunny(ref.videoId),
  };
}

/** Poster frame, when a Bunny pull zone is configured. */
export function videoThumbnail(ref: VideoRef): string | null {
  if (!ref.videoId) return null;
  if (ref.provider === "youtube") {
    return `https://i.ytimg.com/vi/${ref.videoId}/hqdefault.jpg`;
  }
  const zone = process.env.BUNNY_STREAM_PULL_ZONE?.trim();
  if (!zone) return null;
  const host = zone.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${host}/${ref.videoId}/thumbnail.jpg`;
}

/** `07:51` / `1:20:48`. */
export function formatDuration(sec: number): string {
  if (!sec || sec < 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** True when a Bunny library is configured, so the UI can warn if not. */
export function bunnyConfigured(): boolean {
  return Boolean(process.env.BUNNY_STREAM_LIBRARY_ID?.trim());
}
