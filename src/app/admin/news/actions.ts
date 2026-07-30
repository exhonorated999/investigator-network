"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";

/** Reuses the course taxonomy so news topics and course categories match. */
async function resolveCategoryId(name: string | null): Promise<string | null> {
  const clean = (name || "").trim();
  if (!clean) return null;
  const cat = await prisma.category.upsert({
    where: { name: clean },
    update: {},
    create: { name: clean },
  });
  return cat.id;
}

function parseDate(raw: string): Date | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function fields(formData: FormData) {
  return {
    title: String(formData.get("title") || "").trim(),
    summary: String(formData.get("summary") || "").trim(),
    body: String(formData.get("body") || ""),
    sourceName: String(formData.get("sourceName") || "").trim(),
    sourceUrl: String(formData.get("sourceUrl") || "").trim(),
    imageUrl: String(formData.get("imageUrl") || "").trim() || null,
  };
}

function revalidateFeeds(id?: string) {
  revalidatePath("/admin/news");
  revalidatePath("/news");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/news/${id}`);
}

export async function createArticle(formData: FormData) {
  const session = await requireAdmin();
  const f = fields(formData);
  if (!f.title) return;

  const categoryId = await resolveCategoryId(
    formData.get("category") as string | null
  );
  const publishedAt = parseDate(String(formData.get("publishedAt") || ""));

  const article = await prisma.newsArticle.create({
    data: {
      ...f,
      categoryId,
      authorId: session.user?.id ?? null,
      published: formData.get("published") != null,
      ...(publishedAt ? { publishedAt } : {}),
    },
  });

  revalidateFeeds(article.id);
  redirect(`/admin/news/${article.id}`);
}

export async function updateArticle(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const f = fields(formData);
  if (!id || !f.title) return;

  const categoryId = await resolveCategoryId(
    formData.get("category") as string | null
  );
  const publishedAt = parseDate(String(formData.get("publishedAt") || ""));

  await prisma.newsArticle.update({
    where: { id },
    data: {
      ...f,
      categoryId,
      published: formData.get("published") != null,
      ...(publishedAt ? { publishedAt } : {}),
    },
  });

  revalidateFeeds(id);
}

/** Publish / unpublish from the list view without opening the editor. */
export async function toggleArticlePublished(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const article = await prisma.newsArticle.findUnique({ where: { id } });
  if (!article) return;

  await prisma.newsArticle.update({
    where: { id },
    data: { published: !article.published },
  });
  revalidateFeeds(id);
}

export async function deleteArticle(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.newsArticle.delete({ where: { id } });
  revalidateFeeds();
  redirect("/admin/news");
}
