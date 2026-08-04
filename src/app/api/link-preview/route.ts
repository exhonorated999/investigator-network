import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchLinkPreview } from "@/lib/link-preview";

/**
 * Metadata for a link pasted into a community post.
 *
 * Social posts used to render as a bare URL with no title, image, or summary.
 * The feed asks this route for OpenGraph data and upgrades the card in place.
 *
 * Reuses the newsroom's scraper. Results are memoized in-process for six hours
 * because a busy feed re-requests the same handful of links constantly, and a
 * failure is cached briefly too so a blocking site is not hammered.
 */

interface Cached {
  at: number;
  body: PreviewBody | null;
}

interface PreviewBody {
  url: string;
  host: string;
  title: string;
  summary: string;
  imageUrl: string;
  sourceName: string;
}

const TTL_OK = 6 * 60 * 60 * 1000;
const TTL_FAIL = 30 * 60 * 1000;
const MAX_ENTRIES = 500;
const cache = new Map<string, Cached>();

function remember(key: string, body: PreviewBody | null) {
  if (cache.size >= MAX_ENTRIES) {
    // Cheap eviction: drop the oldest inserted key.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), body });
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const raw = new URL(req.url).searchParams.get("url") ?? "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const key = target.toString();
  const hit = cache.get(key);
  if (hit) {
    const ttl = hit.body ? TTL_OK : TTL_FAIL;
    if (Date.now() - hit.at < ttl) {
      return NextResponse.json(
        hit.body ? { ok: true, preview: hit.body } : { ok: false },
        { headers: { "Cache-Control": "private, max-age=3600" } }
      );
    }
    cache.delete(key);
  }

  const result = await fetchLinkPreview(key);
  if (!result.ok) {
    remember(key, null);
    return NextResponse.json({ ok: false });
  }

  const p = result.preview;
  // Nothing worth upgrading the card for.
  if (!p.title && !p.summary && !p.imageUrl) {
    remember(key, null);
    return NextResponse.json({ ok: false });
  }

  const body: PreviewBody = {
    url: p.url || key,
    host: target.hostname.replace(/^www\./, ""),
    title: p.title,
    summary: p.summary,
    imageUrl: p.imageUrl,
    sourceName: p.sourceName,
  };
  remember(key, body);

  return NextResponse.json(
    { ok: true, preview: body },
    { headers: { "Cache-Control": "private, max-age=3600" } }
  );
}
