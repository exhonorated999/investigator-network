/**
 * Minimal OpenGraph / Twitter-card scraper so the newsroom can populate an
 * article from a pasted URL. Deliberately dependency-free: we only need meta
 * tags and, optionally, the paragraph text, and a real DOM parser is overkill.
 */

export interface LinkPreview {
  url: string;
  title: string;
  summary: string;
  imageUrl: string;
  sourceName: string;
  publishedAt: string | null;
  /** Extracted paragraph text, only populated when explicitly requested. */
  body: string;
}

export type LinkPreviewResult =
  | { ok: true; preview: LinkPreview }
  | { ok: false; error: string };

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "\u2019",
  lsquo: "\u2018",
  rdquo: "\u201d",
  ldquo: "\u201c",
};

function decode(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

/** First matching `<meta>` content for any of the given property/name keys. */
function meta(html: string, keys: string[]): string {
  for (const key of keys) {
    const k = key.replace(/[:.]/g, "\\$&");
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name|itemprop)\\s*=\\s*["']${k}["'][^>]*?content\\s*=\\s*["']([^"']*)["']`,
        "i"
      ),
      new RegExp(
        `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*?(?:property|name|itemprop)\\s*=\\s*["']${k}["']`,
        "i"
      ),
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m?.[1]?.trim()) return decode(m[1]);
    }
  }
  return "";
}

function absolute(candidate: string, base: string): string {
  if (!candidate) return "";
  try {
    return new URL(candidate, base).toString();
  } catch {
    return "";
  }
}

/** Pull readable paragraphs, preferring the article/main region. */
function extractBody(html: string): string {
  const scoped =
    html.match(/<article[\s\S]*?<\/article>/i)?.[0] ??
    html.match(/<main[\s\S]*?<\/main>/i)?.[0] ??
    html;

  const cleaned = scoped
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<figure[\s\S]*?<\/figure>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "");

  const paras = [...cleaned.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decode(m[1].replace(/<[^>]+>/g, " ")))
    // Skip nav crumbs, share prompts and cookie notices.
    .filter((t) => t.length > 80);

  const seen = new Set<string>();
  return paras.filter((t) => !seen.has(t) && seen.add(t)).join("\n\n");
}

function hostLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    // Second-to-last label is the brand for both `msn.com` and `en.wikipedia.org`.
    const base = parts.length >= 2 ? parts[parts.length - 2] : host;
    return base
      .split(/[-_]/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  } catch {
    return "";
  }
}

/** Strip an HTML fragment down to paragraph text. */
function htmlToParagraphs(fragment: string): string {
  const paras = [...fragment.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decode(m[1].replace(/<[^>]+>/g, " ")))
    .filter(Boolean);
  if (paras.length > 0) return paras.join("\n\n");
  const flat = decode(fragment.replace(/<[^>]+>/g, " "));
  return flat.length > 40 ? flat : "";
}

/**
 * MSN serves an empty JS shell to non-browsers, so nothing useful comes back
 * from the HTML. Its own content API does return the article — including the
 * original publisher's URL, which is the better link to keep.
 */
async function msnPreview(
  url: URL,
  withBody: boolean
): Promise<LinkPreviewResult | null> {
  if (!/(^|\.)msn\.com$/i.test(url.hostname)) return null;
  const id = url.pathname.match(/\/ar-([A-Za-z0-9]+)/)?.[1];
  if (!id) return null;
  const locale = url.pathname.match(/^\/([a-z]{2}-[a-z]{2})\//i)?.[1] ?? "en-us";

  try {
    const res = await fetch(
      `https://assets.msn.com/content/view/v2/Detail/${locale}/${id}`,
      {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;

    const title = typeof j.title === "string" ? decode(j.title) : "";
    if (!title) return null;

    const provider = (j.provider ?? {}) as { name?: string };
    const images = Array.isArray(j.imageResources)
      ? (j.imageResources as { url?: string; width?: number }[])
      : [];
    const image = images.find((i) => i.url)?.url ?? "";
    const published =
      typeof j.publishedDateTime === "string" ? new Date(j.publishedDateTime) : null;
    const bodyHtml = typeof j.body === "string" ? j.body : "";
    const sourceHref =
      typeof j.sourceHref === "string" && /^https?:\/\//.test(j.sourceHref)
        ? j.sourceHref
        : url.toString();

    return {
      ok: true,
      preview: {
        // Prefer the original publisher: MSN aggregator links rot quickly.
        url: sourceHref,
        title,
        summary: typeof j.abstract === "string" ? decode(j.abstract) : "",
        imageUrl: image ? `${image}?w=1200&h=630&m=6` : "",
        sourceName: provider.name ? decode(provider.name) : hostLabel(sourceHref),
        publishedAt:
          published && !Number.isNaN(published.getTime())
            ? published.toISOString()
            : null,
        body: withBody ? htmlToParagraphs(bodyHtml) : "",
      },
    };
  } catch {
    return null;
  }
}

/** Schema.org NewsArticle blocks, for sites that skip OpenGraph tags. */
function jsonLd(html: string): Record<string, unknown> | null {
  const blocks = [
    ...html.matchAll(
      /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    ),
  ];
  for (const b of blocks) {
    try {
      const parsed = JSON.parse(b[1].trim());
      const list: unknown[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { "@graph"?: unknown[] })["@graph"])
          ? (parsed as { "@graph": unknown[] })["@graph"]
          : [parsed];
      for (const node of list) {
        const n = node as Record<string, unknown>;
        const type = String(n["@type"] ?? "");
        if (/article|newsarticle|blogposting|report/i.test(type)) return n;
      }
    } catch {
      // Malformed JSON-LD is common; just move on.
    }
  }
  return null;
}

function ldString(node: Record<string, unknown>, key: string): string {
  const v = node[key];
  if (typeof v === "string") return decode(v);
  if (Array.isArray(v) && typeof v[0] === "string") return decode(v[0]);
  if (v && typeof v === "object") {
    const inner = (v as Record<string, unknown>).name ?? (v as Record<string, unknown>).url;
    if (typeof inner === "string") return decode(inner);
  }
  return "";
}

export async function fetchLinkPreview(
  rawUrl: string,
  opts: { withBody?: boolean } = {}
): Promise<LinkPreviewResult> {
  const input = rawUrl.trim();
  if (!input) return { ok: false, error: "Paste a URL first." };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return { ok: false, error: "That doesn't look like a URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only http(s) links are supported." };
  }

  // Site-specific adapters first: aggregators that serve JS shells.
  const special = await msnPreview(url, opts.withBody === true);
  if (special) return special;

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "sec-ch-ua": '"Chromium";v="125", "Not:A-Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 403 || res.status === 406 || res.status === 429
            ? `The site blocks automated reads (${res.status}). Fill the fields in by hand.`
            : `Source returned ${res.status}. Fill it in manually.`,
      };
    }
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html") && !type.includes("xml")) {
      return { ok: false, error: `Not a web page (${type || "unknown type"}).` };
    }
    html = (await res.text()).slice(0, 1_500_000);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return {
      ok: false,
      error: /timeout|abort/i.test(msg)
        ? "Source timed out. Fill it in manually."
        : `Could not reach the source (${msg}).`,
    };
  }

  const ld = jsonLd(html);

  const title =
    meta(html, ["og:title", "twitter:title", "dc.title", "headline"]) ||
    (ld ? ldString(ld, "headline") : "") ||
    decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");

  const summary =
    meta(html, ["og:description", "twitter:description", "description"]) ||
    (ld ? ldString(ld, "description") : "");

  const image = absolute(
    meta(html, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]) ||
      (ld ? ldString(ld, "image") : ""),
    url.toString()
  );

  const published =
    meta(html, [
      "article:published_time",
      "og:article:published_time",
      "datePublished",
      "publishdate",
      "date",
    ]) || (ld ? ldString(ld, "datePublished") : "");
  const parsed = published ? new Date(published) : null;

  const canonical =
    absolute(meta(html, ["og:url"]), url.toString()) || url.toString();

  const sourceName =
    meta(html, ["og:site_name", "twitter:site", "application-name"]).replace(
      /^@/,
      ""
    ) ||
    (ld ? ldString(ld, "publisher") : "") ||
    hostLabel(url.toString());

  let body = "";
  if (opts.withBody) {
    body = extractBody(html);
    if (!body && ld) {
      const articleBody = ld.articleBody;
      if (typeof articleBody === "string") {
        body = decode(articleBody).replace(/(?<=[.!?"])\s{2,}/g, "\n\n");
      }
    }
  }

  if (!title && !summary && !image) {
    return {
      ok: false,
      error:
        "That page renders in the browser only — nothing to read server-side. Fill the fields in by hand.",
    };
  }

  return {
    ok: true,
    preview: {
      url: canonical,
      title,
      summary,
      imageUrl: image,
      sourceName,
      publishedAt:
        parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null,
      body,
    },
  };
}
