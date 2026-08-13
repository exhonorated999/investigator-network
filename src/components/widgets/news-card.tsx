"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopicPicker } from "@/components/widgets/topic-picker";
import { hostOf, type FeedArticle, type Topic } from "@/lib/news";

function stamp(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Where a headline goes: the in-app reader when text was pasted, else out. */
export function articleHref(a: FeedArticle): string {
  return a.hasBody || !a.sourceUrl ? `/news/${a.id}` : a.sourceUrl;
}

/**
 * One accordion row. First click previews the article (expands to reveal its
 * artwork and full excerpt while any other open row collapses). A second click
 * on the already-previewed row opens it — the in-app reader for pasted stories,
 * or the original source in a new tab for external links.
 */
function ArticleRow({
  a,
  open,
  onSelect,
}: {
  a: FeedArticle;
  open: boolean;
  onSelect: (a: FeedArticle) => void;
}) {
  const external = !a.hasBody && !!a.sourceUrl;
  const source = a.sourceName || hostOf(a.sourceUrl);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => onSelect(a)}
        aria-expanded={open}
        className="group block w-full py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
            {a.categoryName ?? "General"}
          </span>
          <span className="font-mono text-[10px] text-muted">
            {stamp(a.publishedAt)}
          </span>
        </div>

        <p className="mt-1 text-[15px] leading-snug text-foreground transition group-hover:text-accent-bright">
          {a.title}
        </p>

        {/* Preview reveal: artwork + full excerpt, only while open. */}
        <div
          className={`grid transition-all duration-300 ease-out ${
            open ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            {a.imageUrl ? (
              <div className="bracket mb-2 block aspect-[16/8] w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.imageUrl}
                  alt=""
                  className="h-full w-full object-cover opacity-90"
                />
              </div>
            ) : null}
            {a.summary ? (
              <p className="text-[13px] leading-relaxed text-muted">
                {a.summary}
              </p>
            ) : null}
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-accent-bright/80">
              Click again to {external ? "open source ↗" : "read article →"}
            </p>
          </div>
        </div>

        {/* Compact excerpt, only while closed. */}
        {!open && a.summary ? (
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">
            {a.summary}
          </p>
        ) : null}

        {source ? (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted opacity-70">
            {source}
            {external ? " ↗" : ""}
          </p>
        ) : null}
      </button>
    </div>
  );
}

/**
 * Dashboard news card. The feed is a single-open accordion: clicking a story
 * previews it inline (artwork + excerpt); clicking the open story opens it.
 */
export function NewsCard({
  articles,
  topics,
  selected,
  number = "07",
}: {
  articles: FeedArticle[];
  topics: Topic[];
  selected: string[];
  number?: string;
}) {
  const router = useRouter();
  // Lead story previews by default, mirroring the old artwork-lead layout.
  const [openId, setOpenId] = useState<string | null>(articles[0]?.id ?? null);

  function select(a: FeedArticle) {
    if (a.id !== openId) {
      setOpenId(a.id);
      return;
    }
    // Second click on the previewed story: open it.
    const external = !a.hasBody && !!a.sourceUrl;
    if (external) {
      window.open(a.sourceUrl, "_blank", "noopener,noreferrer");
    } else {
      router.push(`/news/${a.id}`);
    }
  }

  return (
    <section className="panel rule-top flex h-full flex-col p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{number} / Bulletin</p>
          <h2 className="display-sm mt-2 text-[1.15rem]">News feed</h2>
        </div>
        <TopicPicker topics={topics} selected={selected} />
      </header>

      <div className="mt-4 flex-1 min-h-0 max-h-[560px] overflow-y-auto pr-1">
        {articles.length === 0 ? (
          <p className="text-[15px] text-muted">
            {selected.length > 0
              ? "Nothing filed in your topics yet. Widen your selection with Topics."
              : "No articles yet. Staff post curated reading here."}
          </p>
        ) : (
          <div>
            {articles.map((a) => (
              <ArticleRow
                key={a.id}
                a={a}
                open={a.id === openId}
                onSelect={select}
              />
            ))}
          </div>
        )}
      </div>

      <Link
        href="/news"
        className="mt-4 block border-t border-border pt-3 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-muted transition hover:text-accent-bright"
      >
        All bulletins →
      </Link>
    </section>
  );
}
