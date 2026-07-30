import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createArticle, toggleArticlePublished } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminNewsPage() {
  const [articles, categories] = await Promise.all([
    prisma.newsArticle.findMany({
      orderBy: { publishedAt: "desc" },
      include: {
        category: { select: { name: true } },
        author: { select: { name: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const live = articles.filter((a) => a.published).length;

  return (
    <div className="reveal">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow eyebrow-gold">// NEWSROOM</p>
          <h1 className="display-lg mt-2 text-foreground">News feed</h1>
          <p className="mt-2 text-[15px] text-muted">
            Paste an article, tag it with a topic, and it lands on the dashboard
            of every learner following that topic.
          </p>
        </div>
        <p className="font-mono text-[11px] text-muted">
          {String(live).padStart(2, "0")} live / {String(articles.length).padStart(2, "0")} total
        </p>
      </div>

      {/* --------------------------------------------------------- composer */}
      <div className="panel rule-top mt-6 p-5">
        <p className="eyebrow eyebrow-muted">File a new article</p>

        <form action={createArticle} className="mt-4 grid gap-3">
          <input
            name="title"
            required
            placeholder="Headline"
            className="field"
          />

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_200px]">
            <input
              name="sourceUrl"
              type="url"
              placeholder="Source URL (https://…)"
              className="field"
            />
            <input
              name="sourceName"
              placeholder="Source name (e.g. DOJ, Wired)"
              className="field"
            />
            <input
              name="category"
              list="news-cats"
              placeholder="Topic"
              className="field"
            />
            <datalist id="news-cats">
              {categories.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
              {["ICAC", "Sex Offender", "Digital Forensics", "Narcotics", "General"]
                .filter((n) => !categories.some((c) => c.name === n))
                .map((n) => (
                  <option key={n} value={n} />
                ))}
            </datalist>
          </div>

          <textarea
            name="summary"
            rows={2}
            placeholder="Summary / why it matters (shown on the card)"
            className="field resize-y"
          />

          <textarea
            name="body"
            rows={8}
            placeholder="Paste the article text here (optional). Blank lines separate paragraphs. Leave empty to link straight out to the source."
            className="field resize-y font-mono text-[13px]"
          />

          <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-center">
            <input
              name="imageUrl"
              type="url"
              placeholder="Image URL (optional)"
              className="field"
            />
            <label className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-wider text-muted">
              <input
                type="checkbox"
                name="published"
                defaultChecked
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Publish now
            </label>
            <button type="submit" className="btn btn-primary">
              File article
            </button>
          </div>
        </form>
      </div>

      {/* ------------------------------------------------------------- list */}
      <div className="mt-6 grid gap-3">
        {articles.length === 0 ? (
          <p className="text-muted">Nothing filed yet.</p>
        ) : (
          articles.map((a) => (
            <div
              key={a.id}
              className="panel rule-top flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <Link href={`/admin/news/${a.id}`} className="group min-w-0 flex-1">
                <div className="display-sm truncate text-foreground group-hover:text-accent-bright">
                  {a.title}
                </div>
                <div className="mt-1 font-mono text-[11px] text-muted">
                  {a.category?.name ?? "Uncategorized"} ·{" "}
                  {a.publishedAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {a.sourceName ? ` · ${a.sourceName}` : ""}
                  {a.body.trim() ? " · full text" : " · link only"}
                  {a.author?.name ? ` · ${a.author.name}` : ""}
                </div>
              </Link>

              <form action={toggleArticlePublished}>
                <input type="hidden" name="id" value={a.id} />
                <button
                  type="submit"
                  className={`inline-block shrink-0 border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
                    a.published
                      ? "border-success/40 bg-[rgba(74,222,128,0.08)] text-success hover:border-success"
                      : "border-gold/40 bg-[rgba(244,162,97,0.08)] text-gold hover:border-gold"
                  }`}
                >
                  {a.published ? "Live" : "Draft"}
                </button>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
