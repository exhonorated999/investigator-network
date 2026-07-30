/**
 * Server-side "reader mode" for external articles.
 *
 * Most news/gov sites forbid being embedded in an <iframe> (via
 * X-Frame-Options / CSP frame-ancestors), so we cannot render them inline that
 * way. Instead we fetch the page on the server — where those framing rules do
 * not apply — and extract the main article text with a lightweight heuristic,
 * then render it as plain paragraphs inside our own modal. No iframe, no new
 * tab. Extraction is best-effort; callers must handle an empty result.
 */
import * as cheerio from "cheerio";

export interface ReaderResult {
  title: string | null;
  imageUrl: string | null;
  paras: string[];
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0 Safari/537.36";

/** Fetch a URL as HTML with a browser-like UA and a hard timeout. */
async function fetchHtml(url: string, timeoutMs = 7000): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Extract readable article content from a URL. Returns paragraphs plus a best
 * guess at the title and lead image. `paras` is empty when extraction fails
 * (paywall, JS-only page, bot block, etc.).
 */
export async function extractReadable(url: string): Promise<ReaderResult> {
  const empty: ReaderResult = { title: null, imageUrl: null, paras: [] };
  const html = await fetchHtml(url);
  if (!html) return empty;

  const $ = cheerio.load(html);

  // Meta first — cheap and usually reliable.
  const ogTitle =
    $('meta[property="og:title"]').attr("content") ||
    $("title").first().text() ||
    null;
  const ogImage =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    null;

  // Strip chrome that never belongs in the reading column.
  $(
    "script, style, noscript, nav, header, footer, aside, form, iframe, " +
      "figure figcaption, .ad, .ads, .advert, [role='navigation']"
  ).remove();

  // Pick the container with the most paragraph text: prefer <article>/<main>,
  // otherwise scan common content wrappers.
  const candidates = [
    "article",
    "main",
    "[role='main']",
    ".article-body",
    ".post-content",
    ".entry-content",
    ".content",
    "body",
  ];

  let best: { text: string; paras: string[] } = { text: "", paras: [] };
  for (const sel of candidates) {
    const el = $(sel).first();
    if (!el.length) continue;
    const paras: string[] = [];
    el.find("p").each((_, p) => {
      const txt = $(p).text().replace(/\s+/g, " ").trim();
      if (txt.length >= 40) paras.push(txt);
    });
    const text = paras.join(" ");
    if (text.length > best.text.length) best = { text, paras };
    // An <article>/<main> with real content wins immediately.
    if ((sel === "article" || sel === "main") && paras.length >= 3) break;
  }

  // De-dupe consecutive repeats and cap length so the modal stays sane.
  const seen = new Set<string>();
  const paras = best.paras
    .filter((p) => {
      if (seen.has(p)) return false;
      seen.add(p);
      return true;
    })
    .slice(0, 60);

  return {
    title: ogTitle?.trim() || null,
    imageUrl: ogImage?.trim() || null,
    paras,
  };
}
