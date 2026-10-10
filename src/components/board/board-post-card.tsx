"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BoardPostView } from "@/lib/board";
import { boardKindMeta, BOARD_MAX_BODY } from "@/lib/board-config";
import {
  createBoardReply,
  deleteBoardPost,
  deleteBoardReply,
} from "@/app/courses/[slug]/board/actions";

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function NewFlag() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm bg-gold px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-black"
      title="New since your last visit"
    >
      ⚑ New
    </span>
  );
}

export function ReplyForm({
  postId,
  autoFocus = false,
}: {
  postId: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    start(async () => {
      const res = await createBoardReply(postId, body);
      if (res.ok) {
        setBody("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2">
      <textarea
        className="field min-h-[70px] w-full text-sm"
        placeholder="Write a reply…"
        value={body}
        maxLength={BOARD_MAX_BODY}
        autoFocus={autoFocus}
        onChange={(e) => setBody(e.target.value)}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex justify-end">
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={pending || !body.trim()}
        >
          {pending ? "Posting…" : "Reply"}
        </button>
      </div>
    </form>
  );
}

/** Server-page friendly wrapper (plain array instead of a Set). */
export function BoardPostStandalone({
  post,
  viewer,
  newIds,
}: {
  post: BoardPostView;
  viewer: { id: string; isAdmin: boolean };
  newIds: string[];
}) {
  const [ids] = useState(() => new Set(newIds));
  return <BoardPostCard post={post} viewer={viewer} newIds={ids} defaultOpen highlight={false} />;
}

/**
 * One board post with its replies. `newIds` holds post/reply ids that were
 * unread when the viewer arrived, so NEW flags survive the read-marking
 * refresh for the rest of the visit.
 */
export function BoardPostCard({
  post,
  viewer,
  newIds,
  defaultOpen = false,
  highlight = false,
}: {
  post: BoardPostView;
  viewer: { id: string; isAdmin: boolean };
  newIds: Set<string>;
  defaultOpen?: boolean;
  highlight?: boolean;
}) {
  const router = useRouter();
  const meta = boardKindMeta(post.kind);
  const [open, setOpen] = useState(defaultOpen);
  // Introductions collapse to a one-line row so the board stays scannable;
  // they start expanded only when the viewer was sent to this specific post.
  const collapsible = post.kind === "INTRO";
  const [expanded, setExpanded] = useState(!collapsible || defaultOpen);
  const [pending, start] = useTransition();
  const postNew = newIds.has(post.id);
  const freshReplies = post.replies.filter((r) => newIds.has(r.id)).length;
  const canDelete = viewer.isAdmin || post.author.id === viewer.id;

  function removePost() {
    if (!confirm("Delete this post and its replies?")) return;
    start(async () => {
      await deleteBoardPost(post.id);
      router.refresh();
    });
  }
  function removeReply(id: string) {
    if (!confirm("Delete this reply?")) return;
    start(async () => {
      await deleteBoardReply(id);
      router.refresh();
    });
  }

  if (collapsible && !expanded) {
    const agency = post.agency || post.author.agency;
    const preview = post.body.replace(/\s+/g, " ").trim();
    return (
      <article
        id={`board-post-${post.id}`}
        className={`panel ${postNew ? "border-gold/60" : ""}`}
        style={postNew ? { boxShadow: "inset 3px 0 0 var(--gold)" } : undefined}
      >
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface-2"
        >
          <span className="text-sm leading-none">👋</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">
                {post.title || post.author.name}
              </span>
              {post.author.isStaff ? (
                <span className="font-mono text-[9px] uppercase text-gold">Instructor</span>
              ) : null}
              {postNew ? <NewFlag /> : null}
            </span>
            <span className="block truncate text-xs text-muted">
              {agency ? `${agency}` : ""}
              {agency && preview ? " — " : ""}
              {preview}
            </span>
          </span>
          {post.replies.length ? (
            <span className="shrink-0 font-mono text-[10px] text-muted">
              💬 {post.replies.length}
              {freshReplies > 0 ? <span className="ml-1 text-gold">⚑{freshReplies}</span> : null}
            </span>
          ) : null}
          <span className="shrink-0 text-xs text-muted">▾</span>
        </button>
      </article>
    );
  }

  return (
    <article
      id={`board-post-${post.id}`}
      className={`panel p-4 ${pending ? "opacity-50" : ""} ${
        postNew || highlight ? "border-gold/60" : ""
      }`}
      style={
        postNew || highlight
          ? { boxShadow: "inset 3px 0 0 var(--gold)" }
          : undefined
      }
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="tag-chip tag-chip-cyan text-[10px]">
          {meta.icon} {meta.label}
        </span>
        {postNew ? <NewFlag /> : null}
        <span className="ml-auto font-mono text-[10px] text-muted" suppressHydrationWarning>
          {timeAgo(post.createdAt)}
        </span>
        {collapsible ? (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-xs text-muted hover:text-foreground"
            aria-label="Collapse introduction"
          >
            Collapse ▴
          </button>
        ) : null}
      </header>

      {post.title ? (
        <h3 className="mt-2 font-display text-base font-semibold text-foreground">
          {post.title}
        </h3>
      ) : null}

      <p className="mt-1 text-xs text-muted">
        {post.kind === "INTRO" ? "Introduced by " : "Posted by "}
        <span className="text-foreground">{post.author.name}</span>
        {post.author.isStaff ? (
          <span className="ml-1.5 font-mono text-[9px] uppercase text-gold">Instructor</span>
        ) : null}
        {post.kind === "INTRO" && post.agency ? (
          <> · {post.agency}</>
        ) : post.author.agency ? (
          <> · {post.author.agency}</>
        ) : null}
      </p>

      {post.body ? (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
          {post.body}
        </p>
      ) : null}

      {post.kind === "INTRO" && post.contactEmail ? (
        <p className="mt-2 text-xs">
          ✉{" "}
          <a href={`mailto:${post.contactEmail}`} className="text-accent-bright hover:underline">
            {post.contactEmail}
          </a>
        </p>
      ) : null}

      {post.linkUrl ? (
        <a
          href={post.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block truncate text-sm text-accent-bright hover:underline"
        >
          🔗 {post.linkUrl}
        </a>
      ) : null}

      {post.file ? (
        <a
          href={`/api/files/${post.file.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-2 border border-border bg-surface-2 px-3 py-2 text-sm hover:border-accent"
        >
          <span>📄</span>
          <span className="flex-1 truncate">{post.file.filename}</span>
          <span className="font-mono text-[10px] text-muted">{fmtBytes(post.file.sizeBytes)}</span>
        </a>
      ) : null}

      <footer className="mt-3 flex items-center gap-3 border-t border-border pt-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-accent-bright hover:underline"
        >
          💬 {post.replies.length} {post.replies.length === 1 ? "reply" : "replies"}
          {open ? " ▴" : " ▾"}
        </button>
        {freshReplies > 0 ? (
          <span className="font-mono text-[10px] font-bold text-gold">
            ⚑ {freshReplies} new
          </span>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            onClick={removePost}
            className="ml-auto text-[11px] text-muted hover:text-danger"
          >
            Delete
          </button>
        ) : null}
      </footer>

      {open ? (
        <div className="mt-2">
          {post.replies.length ? (
            <ul className="space-y-2">
              {post.replies.map((r) => (
                <li
                  key={r.id}
                  className={`border-l-2 bg-surface-2 px-3 py-2 ${
                    newIds.has(r.id) ? "border-gold" : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 text-[11px] text-muted">
                    <span className="text-foreground">{r.author.name}</span>
                    {r.staff ? (
                      <span className="font-mono text-[9px] uppercase text-gold">Instructor</span>
                    ) : null}
                    {newIds.has(r.id) ? <NewFlag /> : null}
                    <span className="ml-auto" suppressHydrationWarning>
                      {timeAgo(r.createdAt)}
                    </span>
                    {viewer.isAdmin || r.author.id === viewer.id ? (
                      <button
                        type="button"
                        onClick={() => removeReply(r.id)}
                        className="hover:text-danger"
                        title="Delete reply"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-foreground/90">{r.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">No replies yet — be the first.</p>
          )}
          <ReplyForm postId={post.id} />
        </div>
      ) : null}
    </article>
  );
}
