import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteArticle, updateArticle } from "../actions";
import { ArticleForm } from "../article-form";

export const dynamic = "force-dynamic";

/** `YYYY-MM-DDTHH:mm` for a datetime-local input. */
function localValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [article, categories] = await Promise.all([
    prisma.newsArticle.findUnique({
      where: { id },
      include: { category: true, author: { select: { name: true } } },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!article) notFound();

  return (
    <div className="reveal">
      <Link
        href="/admin/news"
        className="eyebrow eyebrow-muted transition hover:text-accent-bright"
      >
        ← Newsroom
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow eyebrow-gold">// ARTICLE</p>
          <h1 className="display-lg mt-2 break-words text-foreground">
            {article.title}
          </h1>
          <p className="mt-2 font-mono text-[11px] text-muted">
            {article.published ? "Live" : "Draft"}
            {article.author?.name ? ` · filed by ${article.author.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/news/${article.id}`} className="btn btn-ghost btn-sm">
            View
          </Link>
        </div>
      </div>

      <div className="panel rule-top mt-6 p-5">
        <ArticleForm
          action={updateArticle}
          categories={categories.map((c) => c.name)}
          submitLabel="Save article"
          initial={{
            id: article.id,
            title: article.title,
            sourceUrl: article.sourceUrl,
            sourceName: article.sourceName,
            category: article.category?.name ?? "",
            summary: article.summary,
            body: article.body,
            imageUrl: article.imageUrl ?? "",
            published: article.published,
            publishedAt: localValue(article.publishedAt),
          }}
        />
      </div>

      <form action={deleteArticle} className="mt-4">
        <input type="hidden" name="id" value={article.id} />
        <button
          type="submit"
          className="border border-danger/40 bg-[rgba(239,68,68,0.07)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-danger transition hover:border-danger"
        >
          Delete article
        </button>
      </form>
    </div>
  );
}
