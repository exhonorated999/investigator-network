"use server";

import { requireUser } from "@/lib/rbac";
import { hostOf, loadArticle, paragraphs } from "@/lib/news";

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
}

/**
 * Full article payload for the in-app reader modal. Fetched on demand when a
 * learner clicks a headline, so feed responses stay light.
 */
export async function fetchArticle(id: string): Promise<ModalArticle | null> {
  await requireUser();
  const a = await loadArticle(id);
  if (!a) return null;

  const paras = paragraphs(a.body);
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
    imageUrl: a.imageUrl,
    paras,
    sourceUrl: a.sourceUrl,
    sourceName: a.sourceName || hostOf(a.sourceUrl),
    hasBody: paras.length > 0,
  };
}
