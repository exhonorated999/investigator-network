import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/viewer";
import { SiteHeader } from "@/components/site-header";
import { hostOf, loadArticle, paragraphs } from "@/lib/news";

export const dynamic = "force-dynamic";

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireViewer();
  const article = await loadArticle(id, viewer);
  if (!article) notFound();

  const source = article.sourceName || hostOf(article.sourceUrl);
  const paras = paragraphs(article.body);

  return (
    <div className="min-h-screen">
      <SiteHeader name={viewer!.name} isAdmin={viewer!.role === "ADMIN"} />

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-8">
        <Link
          href="/news"
          className="eyebrow eyebrow-muted transition hover:text-accent-bright"
        >
          ← The feed
        </Link>

        <article className="reveal reveal-1 mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="tag-chip">
              // {article.category?.name ?? "General"}
            </span>
            <span className="font-mono text-[11px] text-muted">
              {article.publishedAt.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>

          <h1 className="display-lg mt-4 leading-[1.05]">{article.title}</h1>

          {article.summary ? (
            <p className="mt-4 border-l-2 border-accent/50 pl-4 text-[19px] leading-relaxed text-muted">
              {article.summary}
            </p>
          ) : null}

          {article.imageUrl ? (
            <div className="bracket mt-7 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.imageUrl}
                alt=""
                className="w-full object-cover opacity-90"
              />
            </div>
          ) : null}

          {paras.length > 0 ? (
            <div className="mt-8 space-y-5">
              {paras.map((p, i) => (
                <p key={i} className="text-[17px] leading-[1.75] text-foreground/90">
                  {p}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-8 text-[17px] text-muted">
              This entry links out to the original source.
            </p>
          )}

          {article.sourceUrl ? (
            <div className="mt-10 border-t border-border pt-5">
              <p className="eyebrow eyebrow-muted">Source</p>
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="btn btn-ghost btn-sm mt-3"
              >
                {source || "Open original"} ↗
              </a>
            </div>
          ) : null}
        </article>
      </main>
    </div>
  );
}
