import Link from "next/link";
import { requireViewer } from "@/lib/viewer";
import { SiteHeader } from "@/components/site-header";
import { TopicPicker } from "@/components/widgets/topic-picker";
import { ArticleReader } from "@/components/widgets/article-reader";
import {
  hostOf,
  loadArticles,
  loadNewsTopics,
  loadTopics,
  type FeedArticle,
} from "@/lib/news";

export const dynamic = "force-dynamic";

function stamp(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Card({ a, lead }: { a: FeedArticle; lead?: boolean }) {
  const external = !a.hasBody && !!a.sourceUrl;
  const source = a.sourceName || hostOf(a.sourceUrl);

  const body = (
    <>
      {a.imageUrl ? (
        <span
          className={`block overflow-hidden ${lead ? "aspect-[16/7]" : "aspect-[16/9]"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={a.imageUrl}
            alt=""
            className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
          />
        </span>
      ) : null}

      <span className="block p-5">
        <span className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold">
            {a.categoryName ?? "General"}
          </span>
          <span className="font-mono text-[10px] text-muted">
            {stamp(a.publishedAt)}
          </span>
          {external ? (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              ↗ external
            </span>
          ) : null}
        </span>

        <span
          className={`display-sm mt-2 block text-foreground transition group-hover:text-accent-bright ${
            lead ? "text-[1.5rem] leading-tight" : "text-[1.05rem] leading-snug"
          }`}
        >
          {a.title}
        </span>

        {a.summary ? (
          <span className="mt-2 block text-[15px] leading-relaxed text-muted">
            {a.summary}
          </span>
        ) : null}

        {source ? (
          <span className="mt-3 block font-mono text-[10px] uppercase tracking-wider text-muted opacity-70">
            {source}
          </span>
        ) : null}
      </span>
    </>
  );

  const cls = "panel panel-hover rule-top group block overflow-hidden";

  return (
    <ArticleReader id={a.id} className={`${cls} w-full text-left`}>
      {body}
    </ArticleReader>
  );
}

export default async function NewsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
  const viewer = await requireViewer();

  const [topics, selected] = await Promise.all([
    loadTopics(viewer),
    loadNewsTopics(viewer.id),
  ]);

  // An explicit `?topic=` overrides subscriptions; otherwise honour them.
  const active = topic && topics.some((t) => t.id === topic) ? topic : null;
  const articles = active
    ? await loadArticles({ topicId: active, viewer })
    : (await loadArticles({ viewer })).filter(
        (a) =>
          selected.length === 0 ||
          (a.categoryId != null && selected.includes(a.categoryId))
      );

  const [lead, ...rest] = articles;

  return (
    <div className="min-h-screen">
      <SiteHeader name={viewer.name} isAdmin={viewer.role === "ADMIN"} />

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-8">
        <section className="reveal reveal-1 flex flex-wrap items-end justify-between gap-5">
          <div>
            <span className="pill">Intel bulletin</span>
            <h1 className="display-lg mt-4">
              The <span className="glow-text">feed</span>
            </h1>
            <p className="mt-3 max-w-2xl text-[17px] text-muted">
              Curated reading from Investigator Network staff — case law,
              tradecraft and open-source developments across the disciplines you
              work.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TopicPicker topics={topics} selected={selected} />
            <Link href="/dashboard" className="btn btn-ghost btn-sm">
              Dashboard
            </Link>
          </div>
        </section>

        <nav className="reveal reveal-2 mt-7 flex flex-wrap gap-2 border-y border-border py-3">
          <Link
            href="/news"
            className={`font-display text-[11px] font-semibold uppercase tracking-[0.16em] px-3 py-1.5 border transition ${
              active == null
                ? "border-accent-bright bg-[rgba(0,180,216,0.1)] text-accent-bright"
                : "border-border text-muted hover:border-border-strong hover:text-accent-bright"
            }`}
          >
            {selected.length > 0 ? "My topics" : "Everything"}
          </Link>
          {topics
            .filter((t) => t.count > 0)
            .map((t) => (
              <Link
                key={t.id}
                href={`/news?topic=${t.id}`}
                className={`font-display text-[11px] font-semibold uppercase tracking-[0.16em] px-3 py-1.5 border transition ${
                  active === t.id
                    ? "border-accent-bright bg-[rgba(0,180,216,0.1)] text-accent-bright"
                    : "border-border text-muted hover:border-border-strong hover:text-accent-bright"
                }`}
              >
                {t.name}
                <span className="ml-2 font-mono text-[10px] opacity-60">
                  {String(t.count).padStart(2, "0")}
                </span>
              </Link>
            ))}
        </nav>

        {articles.length === 0 ? (
          <p className="reveal reveal-3 mt-10 text-[17px] text-muted">
            Nothing filed here yet.
          </p>
        ) : (
          <div className="reveal reveal-3 mt-7 grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <Card a={lead} lead />
            </div>
            {rest.map((a) => (
              <Card key={a.id} a={a} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
