import Link from "next/link";
import { TopicPicker } from "@/components/widgets/topic-picker";
import { hostOf, type FeedArticle, type Topic } from "@/lib/news";

function stamp(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Where a headline goes: the in-app reader when text was pasted, else out. */
export function articleHref(a: FeedArticle): string {
  return a.hasBody || !a.sourceUrl ? `/news/${a.id}` : a.sourceUrl;
}

export function ArticleRow({ a }: { a: FeedArticle }) {
  const external = !a.hasBody && !!a.sourceUrl;
  const source = a.sourceName || hostOf(a.sourceUrl);

  const inner = (
    <>
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
        {external ? (
          <span className="ml-1 align-middle font-mono text-[10px] text-muted">
            ↗
          </span>
        ) : null}
      </p>
      {a.summary ? (
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">
          {a.summary}
        </p>
      ) : null}
      {source ? (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted opacity-70">
          {source}
        </p>
      ) : null}
    </>
  );

  const cls =
    "group block border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0";

  return external ? (
    <a href={a.sourceUrl} target="_blank" rel="noreferrer noopener" className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={`/news/${a.id}`} className={cls}>
      {inner}
    </Link>
  );
}

/**
 * Dashboard news card. Lead story gets the artwork treatment; the rest are
 * compact rows so the card stays the same height as its neighbours.
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
  const [lead, ...rest] = articles;

  return (
    <section className="panel rule-top flex h-full flex-col p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{number} / Bulletin</p>
          <h2 className="display-sm mt-2 text-[1.15rem]">News feed</h2>
        </div>
        <TopicPicker topics={topics} selected={selected} />
      </header>

      <div className="mt-4 flex-1">
        {articles.length === 0 ? (
          <p className="text-[15px] text-muted">
            {selected.length > 0
              ? "Nothing filed in your topics yet. Widen your selection with Topics."
              : "No articles yet. Staff post curated reading here."}
          </p>
        ) : (
          <>
            {lead.imageUrl ? (
              <Link
                href={articleHref(lead)}
                target={!lead.hasBody && lead.sourceUrl ? "_blank" : undefined}
                className="bracket group mb-3 block aspect-[16/7] overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lead.imageUrl}
                  alt=""
                  className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
                />
              </Link>
            ) : null}

            <div>
              <ArticleRow a={lead} />
              {rest.map((a) => (
                <ArticleRow key={a.id} a={a} />
              ))}
            </div>
          </>
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
