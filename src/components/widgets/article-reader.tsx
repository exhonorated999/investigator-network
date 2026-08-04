"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { fetchArticle, type ModalArticle } from "@/app/news/actions";

/**
 * Wraps an in-app article headline. Clicking opens the article in a modal
 * reader (lazy-loaded via a server action) instead of navigating away, so the
 * learner keeps their place on the dashboard. External links do not use this.
 */
export function ArticleReader({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [article, setArticle] = useState<ModalArticle | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  async function openReader() {
    setOpen(true);
    if (!article) {
      setLoading(true);
      setFailed(false);
      try {
        const a = await fetchArticle(id);
        setArticle(a);
      } catch {
        // A transient server/DB hiccup must never leave the reader stuck on a
        // spinner with the page scroll-locked. Surface a recoverable error.
        setFailed(true);
      } finally {
        setLoading(false);
      }
    }
  }

  // Esc to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={openReader}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openReader();
          }
        }}
        className={`cursor-pointer ${className ?? ""}`}
      >
        {children}
      </div>

      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-[rgba(3,5,10,0.72)] px-4 py-[6vh] backdrop-blur-sm"
              onClick={() => setOpen(false)}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="panel rule-top bracket relative w-full max-w-2xl p-7 sm:p-9"
                style={{ boxShadow: "0 40px 100px -30px rgba(0,0,0,0.9)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center border border-border-strong bg-surface text-muted transition hover:border-accent-bright hover:text-accent-bright"
                >
                  <span className="text-lg leading-none">×</span>
                </button>

                {loading ? (
                  <p className="py-16 text-center font-mono text-sm text-muted">
                    Loading article…
                  </p>
                ) : failed ? (
                  <div className="py-16 text-center">
                    <p className="font-mono text-sm text-danger">
                      Couldn&rsquo;t load this article.
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-muted">
                      A temporary hiccup — please try again.
                    </p>
                    <button
                      type="button"
                      onClick={openReader}
                      className="btn btn-ghost btn-sm mt-4"
                    >
                      Retry
                    </button>
                  </div>
                ) : !article ? (
                  <p className="py-16 text-center font-mono text-sm text-muted">
                    Article unavailable.
                  </p>
                ) : (
                  <article>
                    <div className="flex flex-wrap items-center gap-3 pr-10">
                      <span className="tag-chip">// {article.categoryName}</span>
                      <span className="font-mono text-[11px] text-muted">
                        {article.publishedAt}
                      </span>
                      {article.reader ? (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-accent-bright">
                          Reader view · {article.sourceName}
                        </span>
                      ) : null}
                    </div>

                    <h1 className="display-sm mt-4 text-[1.6rem] leading-[1.1]">
                      {article.title}
                    </h1>

                    {article.summary ? (
                      <p className="mt-4 border-l-2 border-accent/50 pl-4 text-[17px] leading-relaxed text-muted">
                        {article.summary}
                      </p>
                    ) : null}

                    {article.imageUrl ? (
                      <div className="mt-6 overflow-hidden border border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={article.imageUrl}
                          alt=""
                          className="w-full object-cover opacity-90"
                        />
                      </div>
                    ) : null}

                    {article.paras.length > 0 ? (
                      <div className="mt-6 space-y-4">
                        {article.paras.map((p, i) => (
                          <p
                            key={i}
                            className="text-[16px] leading-[1.75] text-foreground/90"
                          >
                            {p}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-6 text-[15px] text-muted">
                        This article can&rsquo;t be shown inline — the source
                        doesn&rsquo;t allow it. Open the original below.
                      </p>
                    )}

                    {article.sourceUrl ? (
                      <div className="mt-8 border-t border-border pt-5">
                        <p className="eyebrow eyebrow-muted">Source</p>
                        <a
                          href={article.sourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="btn btn-ghost btn-sm mt-3"
                        >
                          {article.reader || article.paras.length === 0
                            ? `Open original at ${article.sourceName}`
                            : article.sourceName || "Open original"}{" "}
                          ↗
                        </a>
                      </div>
                    ) : null}
                  </article>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
