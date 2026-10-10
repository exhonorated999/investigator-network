"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { BoardPostView } from "@/lib/board";
import { BOARD_KINDS } from "@/lib/board-config";
import { markBoardViewed } from "@/app/courses/[slug]/board/actions";
import { BoardPostCard } from "./board-post-card";
import { BoardComposer } from "./board-composer";

function unreadIds(posts: BoardPostView[]): string[] {
  const out: string[] = [];
  for (const p of posts) {
    if (p.isNew) out.push(p.id);
    for (const r of p.replies) if (r.isNew) out.push(r.id);
  }
  return out;
}

/**
 * Sidebar trigger + slide-out Class Board. Opening it marks everything
 * visible as read (clearing the sidebar flag and the dashboard alerts);
 * NEW flags stay on screen for the rest of the visit.
 */
export function BoardPanel({
  slug,
  courseTitle,
  posts,
  viewer,
  initialOpen = false,
  focusPostId = null,
}: {
  slug: string;
  courseTitle: string;
  posts: BoardPostView[];
  viewer: { id: string; name: string; agency: string; isAdmin: boolean };
  initialOpen?: boolean;
  focusPostId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [composing, setComposing] = useState(false);
  const [filter, setFilter] = useState<string>("ALL");
  const [seen, setSeen] = useState<Set<string>>(() => new Set(unreadIds(posts)));

  const unreadCount = posts.filter((p) => p.unread).length;

  // Keep NEW flags for anything that was unread at any point this visit.
  useEffect(() => {
    const ids = unreadIds(posts);
    if (!ids.length) return;
    setSeen((prev) => {
      if (ids.every((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, [posts]);

  // While open, mark unread posts as viewed.
  useEffect(() => {
    if (!open) return;
    const ids = posts.filter((p) => p.unread || p.replies.some((r) => r.isNew)).map((p) => p.id);
    if (!ids.length) return;
    let cancelled = false;
    markBoardViewed(ids).then(() => {
      if (!cancelled) router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [open, posts, router]);

  // Scroll to a focused post when arriving from a notification link.
  useEffect(() => {
    if (!open || !focusPostId) return;
    const t = setTimeout(() => {
      document
        .getElementById(`board-post-${focusPostId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
    return () => clearTimeout(t);
  }, [open, focusPostId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const closeComposer = useCallback(() => setComposing(false), []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of posts) c[p.kind] = (c[p.kind] ?? 0) + 1;
    return c;
  }, [posts]);
  const shown = filter === "ALL" ? posts : posts.filter((p) => p.kind === filter);

  // Rendered into <body> so the drawer is never trapped under course content
  // (the sticky sidebar creates its own stacking context).
  if (!mounted) return null;
  return createPortal(
    <>
      {/* ------------------------------------------------ edge tab */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close class board" : "Open class board"}
        title={
          unreadCount > 0
            ? `Class Board — ${unreadCount} new since your last visit`
            : "Class Board"
        }
        className={`fixed top-1/2 z-[1001] flex -translate-y-1/2 flex-col items-center gap-2 rounded-r-md border border-l-0 px-1.5 py-3 shadow-lg transition-all duration-200 ${
          open
            ? "left-0 hidden border-accent bg-surface-2 text-foreground md:left-[860px] md:flex"
            : unreadCount > 0
              ? "left-0 border-gold/70 bg-surface text-foreground hover:bg-surface-2 md:left-[320px]"
              : "left-0 border-border bg-surface text-muted hover:bg-surface-2 hover:text-foreground md:left-[320px]"
        }`}
        style={
          !open && unreadCount > 0
            ? { boxShadow: "0 0 14px rgba(244,162,97,0.45)" }
            : undefined
        }
      >
        <span className="text-base leading-none">💬</span>
        <span
          className="font-display text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ writingMode: "vertical-rl" }}
        >
          {open ? "Close" : "Board"}
        </span>
        {!open && unreadCount > 0 ? (
          <span className="inline-flex animate-pulse items-center rounded-sm bg-gold px-1 py-0.5 font-mono text-[10px] font-bold leading-none text-black">
            ⚑{unreadCount}
          </span>
        ) : null}
      </button>

      {/* ------------------------------------------------ backdrop */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[999] bg-black/60 transition-opacity md:left-[320px] ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* ------------------------------------------------ panel */}
      <section
        role="dialog"
        aria-label="Class board"
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-[1000] flex w-full flex-col border-r border-border bg-surface shadow-2xl transition-all duration-200 md:left-[320px] md:w-[540px] ${
          open ? "visible translate-x-0 opacity-100" : "invisible -translate-x-6 opacity-0"
        }`}
      >
        <header className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="flex-1">
            <p className="eyebrow eyebrow-gold text-[10px]">Class Board</p>
            <h2 className="display-sm mt-1 text-base">{courseTitle}</h2>
            <p className="mt-1 text-xs text-muted">
              Introduce yourself, ask questions between classes, share wins and resources.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xl leading-none text-muted hover:text-foreground"
            aria-label="Close class board"
          >
            ×
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-5 py-3">
          {[{ kind: "ALL", plural: "All", icon: "" }, ...BOARD_KINDS].map((k) => {
            const n = k.kind === "ALL" ? posts.length : counts[k.kind] ?? 0;
            return (
              <button
                key={k.kind}
                type="button"
                onClick={() => setFilter(k.kind)}
                className={`border px-2 py-0.5 text-[11px] transition ${
                  filter === k.kind
                    ? "border-accent text-foreground"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                {k.icon ? `${k.icon} ` : ""}
                {k.plural} <span className="text-muted">{n}</span>
              </button>
            );
          })}
          {!composing ? (
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="btn btn-gold btn-sm ml-auto"
            >
              + New post
            </button>
          ) : null}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {composing ? (
            <BoardComposer
              slug={slug}
              defaults={{ name: viewer.name, agency: viewer.agency }}
              onDone={closeComposer}
            />
          ) : null}

          {shown.length ? (
            shown.map((p) => (
              <BoardPostCard
                key={p.id}
                post={p}
                viewer={viewer}
                newIds={seen}
                defaultOpen={p.id === focusPostId}
                highlight={p.id === focusPostId}
              />
            ))
          ) : (
            <div className="py-10 text-center text-sm text-muted">
              {posts.length
                ? "Nothing in this category yet."
                : "No posts yet. Start things off by introducing yourself 👋"}
            </div>
          )}
        </div>
      </section>
    </>,
    document.body
  );
}
