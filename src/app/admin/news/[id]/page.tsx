import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteArticle, updateArticle } from "../actions";

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

      <form action={updateArticle} className="panel rule-top mt-6 grid gap-3 p-5">
        <input type="hidden" name="id" value={article.id} />

        <label className="eyebrow eyebrow-muted">Headline</label>
        <input
          name="title"
          required
          defaultValue={article.title}
          className="field"
        />

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_200px]">
          <div className="grid gap-2">
            <label className="eyebrow eyebrow-muted">Source URL</label>
            <input
              name="sourceUrl"
              type="url"
              defaultValue={article.sourceUrl}
              className="field"
            />
          </div>
          <div className="grid gap-2">
            <label className="eyebrow eyebrow-muted">Source name</label>
            <input
              name="sourceName"
              defaultValue={article.sourceName}
              className="field"
            />
          </div>
          <div className="grid gap-2">
            <label className="eyebrow eyebrow-muted">Topic</label>
            <input
              name="category"
              list="news-cats"
              defaultValue={article.category?.name ?? ""}
              className="field"
            />
            <datalist id="news-cats">
              {categories.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>
        </div>

        <label className="eyebrow eyebrow-muted mt-1">Summary</label>
        <textarea
          name="summary"
          rows={2}
          defaultValue={article.summary}
          className="field resize-y"
        />

        <label className="eyebrow eyebrow-muted mt-1">
          Article text (blank = link out only)
        </label>
        <textarea
          name="body"
          rows={14}
          defaultValue={article.body}
          className="field resize-y font-mono text-[13px]"
        />

        <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
          <div className="grid gap-2">
            <label className="eyebrow eyebrow-muted">Image URL</label>
            <input
              name="imageUrl"
              type="url"
              defaultValue={article.imageUrl ?? ""}
              className="field"
            />
          </div>
          <div className="grid gap-2">
            <label className="eyebrow eyebrow-muted">Published at</label>
            <input
              name="publishedAt"
              type="datetime-local"
              defaultValue={localValue(article.publishedAt)}
              className="field"
            />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <label className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-wider text-muted">
            <input
              type="checkbox"
              name="published"
              defaultChecked={article.published}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Published
          </label>
          <button type="submit" className="btn btn-primary">
            Save article
          </button>
        </div>
      </form>

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
