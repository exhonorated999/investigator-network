import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { topicLabel } from "@/lib/community";
import {
  setPostHidden,
  setCommentHidden,
  deletePost,
  deleteComment,
} from "./actions";

export const dynamic = "force-dynamic";

type Filter = "hidden" | "visible" | "all";

const FILTER_TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "visible", label: "Visible" },
  { key: "hidden", label: "Hidden" },
];

function excerpt(body: string, max = 220): string {
  const clean = body.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max).trimEnd() + "…" : clean;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "all" } = await searchParams;
  const activeFilter: Filter =
    filter === "hidden" || filter === "visible" ? filter : "all";

  const where = {
    ...(activeFilter === "hidden"
      ? { hidden: true }
      : activeFilter === "visible"
        ? { hidden: false }
        : {}),
  };

  const posts = await prisma.post.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 60,
    include: {
      author: { select: { name: true, agency: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { name: true, agency: true } },
          reactions: { select: { id: true } },
        },
      },
      reactions: { select: { id: true } },
    },
  });

  const hiddenCount = await prisma.post.count({ where: { hidden: true } });
  const hiddenCommentCount = await prisma.postComment.count({
    where: { hidden: true },
  });

  return (
    <div className="reveal">
      {/* ----------------------------------------------------------- header */}
      <p className="eyebrow eyebrow-gold">// COMMUNITY MODERATION</p>
      <h1 className="display-lg mt-2 text-foreground">Social feed moderation</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-muted">
        Review, hide, unhide, or remove community posts and comments. Hidden
        items disappear from the learner feed but remain here for audit.
      </p>

      {/* ---------------------------------------------------------- summary */}
      <div className="mt-5 flex flex-wrap gap-3">
        <div className="panel rule-top px-4 py-3">
          <p className="eyebrow eyebrow-muted">Hidden posts</p>
          <p className="display-sm mt-1 text-gold">{hiddenCount}</p>
        </div>
        <div className="panel rule-top px-4 py-3">
          <p className="eyebrow eyebrow-muted">Hidden comments</p>
          <p className="display-sm mt-1 text-gold">{hiddenCommentCount}</p>
        </div>
      </div>

      {/* ------------------------------------------------------------- tabs */}
      <div className="mt-6 flex flex-wrap gap-1">
        {FILTER_TABS.map((t) => {
          const active = t.key === activeFilter;
          return (
            <Link
              key={t.key}
              href={`/admin/moderation?filter=${t.key}`}
              className={`shrink-0 border-l-2 px-3 py-2 font-display text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                active
                  ? "border-accent-bright bg-[rgba(0,180,216,0.08)] text-accent-bright"
                  : "border-transparent text-muted hover:border-border-strong hover:text-accent-bright"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- list */}
      <div className="mt-4 grid gap-3">
        {posts.length === 0 ? (
          <p className="text-muted">No posts match this filter.</p>
        ) : (
          posts.map((post) => {
            const visibleComments = post.comments.filter((c) => !c.hidden);
            const hiddenComments = post.comments.filter((c) => c.hidden);

            return (
              <div key={post.id} className="panel rule-top p-4">
                {/* --- post header + body --- */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent-bright">
                        {topicLabel(post.topic)}
                      </span>
                      {post.hidden && (
                        <span className="inline-block border border-gold/40 bg-[rgba(244,162,97,0.08)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-foreground">
                      {excerpt(post.body)}
                    </p>
                    <p className="mt-2 font-mono text-[11px] text-muted">
                      {post.author.name} · {post.author.agency} ·{" "}
                      {formatDate(post.createdAt)} ·{" "}
                      {visibleComments.length} comment
                      {visibleComments.length === 1 ? "" : "s"} ·{" "}
                      {post.reactions.length} reaction
                      {post.reactions.length === 1 ? "" : "s"}
                      {hiddenComments.length > 0
                        ? ` · ${hiddenComments.length} hidden comment${hiddenComments.length === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </div>

                  {/* --- post actions (sibling forms, NOT nested) --- */}
                  <div className="flex shrink-0 items-center gap-2">
                    <form action={setPostHidden}>
                      <input type="hidden" name="id" value={post.id} />
                      <input
                        type="hidden"
                        name="hidden"
                        value={post.hidden ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        className={`btn btn-ghost btn-sm ${
                          post.hidden
                            ? "border-success/40 text-success hover:border-success hover:bg-[rgba(74,222,128,0.08)]"
                            : "border-gold/40 text-gold hover:border-gold hover:bg-[rgba(244,162,97,0.08)]"
                        }`}
                      >
                        {post.hidden ? "Unhide" : "Hide"}
                      </button>
                    </form>
                    <form action={deletePost}>
                      <input type="hidden" name="id" value={post.id} />
                      <button
                        type="submit"
                        className="btn btn-ghost btn-sm border-danger/40 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)] hover:text-danger"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>

                {/* --- comments for this post --- */}
                {post.comments.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="eyebrow eyebrow-muted mb-2">Comments</p>
                    <div className="grid gap-2">
                      {post.comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="flex flex-wrap items-start justify-between gap-2 rounded-sm border border-border bg-[rgba(0,0,0,0.15)] px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {comment.hidden && (
                                <span className="inline-block border border-gold/40 bg-[rgba(244,162,97,0.08)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-gold">
                                  Hidden
                                </span>
                              )}
                              <span className="font-mono text-[10px] text-muted">
                                {comment.author.name} · {comment.author.agency}
                              </span>
                            </div>
                            <p
                              className={`mt-1 text-[13px] leading-relaxed ${
                                comment.hidden ? "text-muted line-through" : "text-foreground"
                              }`}
                            >
                              {excerpt(comment.body, 160)}
                            </p>
                            <p className="mt-1 font-mono text-[10px] text-muted">
                              {formatDate(comment.createdAt)} ·{" "}
                              {comment.reactions.length} reaction
                              {comment.reactions.length === 1 ? "" : "s"}
                            </p>
                          </div>

                          {/* comment actions (sibling forms) */}
                          <div className="flex shrink-0 items-center gap-1.5">
                            <form action={setCommentHidden}>
                              <input type="hidden" name="id" value={comment.id} />
                              <input
                                type="hidden"
                                name="hidden"
                                value={comment.hidden ? "false" : "true"}
                              />
                              <button
                                type="submit"
                                className={`btn btn-ghost btn-sm text-[10px] ${
                                  comment.hidden
                                    ? "border-success/40 text-success hover:border-success hover:bg-[rgba(74,222,128,0.08)]"
                                    : "border-gold/40 text-gold hover:border-gold hover:bg-[rgba(244,162,97,0.08)]"
                                }`}
                              >
                                {comment.hidden ? "Unhide" : "Hide"}
                              </button>
                            </form>
                            <form action={deleteComment}>
                              <input type="hidden" name="id" value={comment.id} />
                              <button
                                type="submit"
                                className="btn btn-ghost btn-sm border-danger/40 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)] hover:text-danger"
                              >
                                Delete
                              </button>
                            </form>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
