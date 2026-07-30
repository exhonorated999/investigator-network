"use server";

import { requireUser } from "@/lib/rbac";
import { hostOf, loadArticle, paragraphs } from "@/lib/news";
import { extractReadable } from "@/lib/reader";

export interface ModalArticle {
  id: string;
  title: string;
  categoryName: string;
  publishedAt: string;
  summary: string;
  imageUrl: string | null;
  paras: string[];
  sourceUrl: string;
  sourceName: string;
  hasBody: boolean;
  /** True when `paras` came from server-side reader extraction (not pasted). */
  reader: boolean;
}

/**
 * Full article payload for the in-app reader modal. Fetched on demand when a
 * learner clicks a headline, so feed responses stay light.
 */
export async function fetchArticle(id: string): Promise<ModalArticle | null> {
  await requireUser();
  const a = await loadArticle(id);
  if (!a) return null;

  let paras = paragraphs(a.body);
  const hasBody = paras.length > 0;
  let reader = false;
  let imageUrl = a.imageUrl;

  // Link-only article: try to render the source inline via server-side reader
  // extraction (iframes are blocked by most sites' CSP). Best-effort — if it
  // yields nothing, the modal falls back to summary + "open original".
  if (!hasBody && a.sourceUrl) {
    const r = await extractReadable(a.sourceUrl);
    if (r.paras.length > 0) {
      paras = r.paras;
      reader = true;
      if (!imageUrl && r.imageUrl) imageUrl = r.imageUrl;
    }
  }

  return {
    id: a.id,
    title: a.title,
    categoryName: a.category?.name ?? "General",
    publishedAt: a.publishedAt.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    summary: a.summary,
    imageUrl,
    paras,
    sourceUrl: a.sourceUrl,
    sourceName: a.sourceName || hostOf(a.sourceUrl),
    hasBody,
    reader,
  };
}
