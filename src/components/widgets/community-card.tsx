"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  COMMUNITY_TOPICS,
  REACTIONS,
  type FeedComment,
  type FeedPost,
} from "@/lib/community";
import {
  createComment,
  createPost,
  deleteComment,
  deletePost,
  setCommentHidden,
  setPostHidden,
  toggleReaction,
} from "@/app/community/actions";
import { Avatar, RoleBadge } from "@/components/widgets/avatar";

/* -------------------------------------------------------------- reactions -- */

function ReactionBar({
  reactions,
  target,
}: {
  reactions: FeedPost["reactions"];
  target: { postId?: string; commentId?: string };
}) {
  const [pending, start] = useTransition();
  const byKind = new Map(reactions.map((r) => [r.kind, r]));

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {REACTIONS.map((r) => {
        const summary = byKind.get(r.kind);
        const mine = summary?.mine ?? false;
        const count = summary?.count ?? 0;
        return (
          <button
            key={r.kind}
            type="button"
            disabled={pending}
            onClick={() => start(() => void toggleReaction({ kind: r.kind, ...target }))}
            title={r.label}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] transition disabled:opacity-50 ${
              mine
                ? "border-accent-bright/70 bg-[rgba(0,180,216,0.12)] text-accent-bright"
                : "border-border text-muted hover:border-border-strong hover:text-foreground"
            }`}
          >
            <span className="leading-none">{r.emoji}</span>
            {count > 0 ? (
              <span className="font-mono text-[11px] leading-none">{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ comment form */

function CommentForm({
  postId,
  parentId,
  placeholder,
  onDone,
}: {
  postId: string;
  parentId?: string;
  placeholder: string;
  onDone?: () => void;
}) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    const body = value.trim();
    if (!body) return;
    const fd = new FormData();
    fd.set("postId", postId);
    fd.set("body", body);
    if (parentId) fd.set("parentId", parentId);
    start(async () => {
      await createComment(fd);
      setValue("");
      onDone?.();
    });
  }

  return (
    <div className="mt-2 flex items-end gap-2">
      <textarea
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        className="field min-h-[38px] flex-1 resize-none px-3 py-2 text-[14px]"
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending || !value.trim()}
        className="btn btn-primary btn-sm shrink-0 disabled:opacity-40"
      >
        {pending ? "…" : "Reply"}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- comment -- */

function CommentItem({
  comment,
  postId,
  isAdmin,
  depth,
}: {
  comment: FeedComment;
  postId: string;
  isAdmin: boolean;
  depth: number;
}) {
  const [replying, setReplying] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className={depth > 0 ? "ml-4 border-l border-border pl-3" : ""}>
      <div className="py-2">
        <div className="flex items-start gap-2">
          <Avatar name={comment.author.name} role={comment.author.role} size={26} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-semibold text-foreground">
                {comment.author.name}
              </span>
              <RoleBadge role={comment.author.role} />
              <span className="font-mono text-[10px] text-muted">{comment.ago}</span>
              {comment.hidden ? (
                <span className="font-mono text-[10px] uppercase text-gold">hidden</span>
              ) : null}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-[14px] leading-snug text-foreground/90">
              {comment.body}
            </p>

            <div className="mt-1 flex items-center gap-3">
              <ReactionBar reactions={comment.reactions} target={{ commentId: comment.id }} />
              <button
                type="button"
                onClick={() => setReplying((v) => !v)}
                className="font-mono text-[11px] uppercase tracking-wide text-muted transition hover:text-accent-bright"
              >
                {replying ? "Cancel" : "Reply"}
              </button>
              {isAdmin ? (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(() =>
                        void setCommentHidden({
                          commentId: comment.id,
                          hidden: !comment.hidden,
                        })
                      )
                    }
                    className="font-mono text-[11px] uppercase tracking-wide text-muted transition hover:text-gold"
                  >
                    {comment.hidden ? "Unhide" : "Hide"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(() => void deleteComment({ commentId: comment.id }))
                    }
                    className="font-mono text-[11px] uppercase tracking-wide text-muted transition hover:text-red-400"
                  >
                    Delete
                  </button>
                </span>
              ) : null}
            </div>

            {replying ? (
              <CommentForm
                postId={postId}
                parentId={comment.id}
                placeholder={`Reply to ${comment.author.name.split(" ")[0]}…`}
                onDone={() => setReplying(false)}
              />
            ) : null}
          </div>
        </div>
      </div>

      {comment.replies.length > 0 ? (
        <div>
          {comment.replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              postId={postId}
              isAdmin={isAdmin}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------- post -- */

function PostItem({ post, isAdmin }: { post: FeedPost; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <article
      className={`border-b border-border py-4 first:pt-0 last:border-b-0 ${
        post.hidden ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar name={post.author.name} role={post.author.role} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-foreground">
              {post.author.name}
            </span>
            <RoleBadge role={post.author.role} />
            {post.hidden ? (
              <span className="font-mono text-[10px] uppercase text-gold">hidden</span>
            ) : null}
          </div>
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted">
            {post.author.agency || "—"} · {post.ago}
          </p>
        </div>

        {isAdmin ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(() =>
                  void setPostHidden({ postId: post.id, hidden: !post.hidden })
                )
              }
              className="font-mono text-[11px] uppercase tracking-wide text-muted transition hover:text-gold"
            >
              {post.hidden ? "Unhide" : "Hide"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm("Delete this post permanently?"))
                  start(() => void deletePost({ postId: post.id }));
              }}
              className="font-mono text-[11px] uppercase tracking-wide text-muted transition hover:text-red-400"
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>

      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
        {post.body}
      </p>

      {post.imageUrl ? (
        <div className="mt-3 overflow-hidden border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt="" className="w-full object-cover" />
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-3">
        <ReactionBar reactions={post.reactions} target={{ postId: post.id }} />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 font-mono text-[11px] uppercase tracking-wide text-muted transition hover:text-accent-bright"
        >
          {post.commentCount} {post.commentCount === 1 ? "answer" : "answers"}
          <span className="ml-1">{open ? "▲" : "▼"}</span>
        </button>
      </div>

      {open ? (
        <div className="mt-2 border-t border-border pt-2">
          {post.comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              postId={post.id}
              isAdmin={isAdmin}
              depth={0}
            />
          ))}
          <CommentForm postId={post.id} placeholder="Write an answer…" />
        </div>
      ) : null}
    </article>
  );
}

/* --------------------------------------------------------------- composer -- */

function Composer({ topic, topicLabel }: { topic: string; topicLabel: string }) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    const body = value.trim();
    if (!body) return;
    const fd = new FormData();
    fd.set("topic", topic);
    fd.set("body", body);
    start(async () => {
      await createPost(fd);
      setValue("");
    });
  }

  return (
    <div className="rounded-sm border border-border bg-surface-2/40 p-3">
      <textarea
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={`Ask the ${topicLabel} community a question…`}
        className="field min-h-[52px] w-full resize-none px-3 py-2 text-[14px]"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted">
          ⌘/Ctrl + Enter to post
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !value.trim()}
          className="btn btn-primary btn-sm disabled:opacity-40"
        >
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- the card -- */

export function CommunityCard({
  feeds,
  counts,
  isAdmin,
  number = "08",
  variant = "card",
}: {
  feeds: Record<string, FeedPost[]>;
  counts: Record<string, number>;
  isAdmin: boolean;
  number?: string;
  variant?: "card" | "page";
}) {
  const [topic, setTopic] = useState(COMMUNITY_TOPICS[0].id);
  const active = COMMUNITY_TOPICS.find((t) => t.id === topic) ?? COMMUNITY_TOPICS[0];
  const posts = feeds[topic] ?? [];

  const scrollClass =
    variant === "page"
      ? "flex-1"
      : "flex-1 max-h-[560px] overflow-y-auto pr-1";

  return (
    <section className="panel rule-top flex h-full flex-col p-5">
      <header>
        <p className="eyebrow">{number} / Community</p>
        <h2 className="display-sm mt-2 text-[1.15rem]">The Wire</h2>

        {/* topic tabs */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {COMMUNITY_TOPICS.map((t) => {
            const on = t.id === topic;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTopic(t.id)}
                className={`flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em] transition ${
                  on
                    ? "border-accent-bright bg-[rgba(0,180,216,0.1)] text-accent-bright"
                    : "border-border text-muted hover:border-border-strong hover:text-foreground"
                }`}
              >
                {t.label}
                <span className="opacity-70">{counts[t.id] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </header>

      <p className="mt-2 text-[13px] text-muted">{active.blurb}</p>

      <div className="mt-3">
        <Composer topic={active.id} topicLabel={active.label} />
      </div>

      <div className={`mt-3 ${scrollClass}`}>
        {posts.length === 0 ? (
          <p className="py-10 text-center text-[15px] text-muted">
            No posts in {active.label} yet. Start the conversation above.
          </p>
        ) : (
          posts.map((p) => <PostItem key={p.id} post={p} isAdmin={isAdmin} />)
        )}
      </div>

      {variant === "card" ? (
        <Link
          href="/community"
          className="mt-4 block border-t border-border pt-3 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-muted transition hover:text-accent-bright"
        >
          Open community →
        </Link>
      ) : null}
    </section>
  );
}
