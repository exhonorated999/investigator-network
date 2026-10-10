import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { boardKindMeta } from "@/lib/board-config";
import {
  setBoardPostHidden,
  adminDeleteBoardPost,
  setBoardReplyHidden,
  adminDeleteBoardReply,
  adminBoardReply,
} from "./actions";

function fmt(d: Date) {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const HIDE_BTN = (hidden: boolean) =>
  `btn btn-ghost btn-sm text-[10px] ${
    hidden
      ? "border-success/40 text-success hover:border-success"
      : "border-gold/40 text-gold hover:border-gold"
  }`;
const DEL_BTN =
  "btn btn-ghost btn-sm text-[10px] border-danger/40 text-danger hover:border-danger hover:text-danger";

/** Course class-board posts + replies for the moderation console. */
export async function BoardModeration({ filter }: { filter: "all" | "visible" | "hidden" }) {
  const where =
    filter === "hidden"
      ? { OR: [{ hidden: true }, { replies: { some: { hidden: true } } }] }
      : filter === "visible"
        ? { hidden: false }
        : {};

  const posts = await prisma.boardPost.findMany({
    where,
    orderBy: { lastActivityAt: "desc" },
    take: 80,
    include: {
      course: { select: { slug: true, title: true } },
      author: { select: { name: true, agency: true, email: true } },
      file: { select: { id: true, filename: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      },
    },
  });

  if (!posts.length) {
    return <p className="mt-4 text-muted">No class-board posts match this filter.</p>;
  }

  return (
    <div className="mt-4 grid gap-3">
      {posts.map((p) => {
        const meta = boardKindMeta(p.kind);
        return (
          <div key={p.id} className="panel rule-top p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent-bright">
                    {meta.icon} {meta.label}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    {p.course.title}
                  </span>
                  {p.hidden ? (
                    <span className="border border-gold/40 px-2 py-0.5 font-mono text-[10px] uppercase text-gold">
                      Hidden
                    </span>
                  ) : null}
                </div>
                {p.title ? (
                  <p className="mt-1.5 font-semibold text-foreground">{p.title}</p>
                ) : null}
                <p className="mt-0.5 text-xs text-muted">
                  {p.author.name}
                  {p.agency || p.author.agency ? ` · ${p.agency || p.author.agency}` : ""} ·{" "}
                  {p.author.email} · {fmt(p.createdAt)}
                </p>
                {p.body ? (
                  <p className="mt-2 whitespace-pre-line text-sm text-foreground/90">{p.body}</p>
                ) : null}
                {p.contactEmail ? (
                  <p className="mt-1 text-xs text-muted">Contact: {p.contactEmail}</p>
                ) : null}
                {p.linkUrl ? (
                  <a
                    href={p.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-xs text-accent-bright hover:underline"
                  >
                    🔗 {p.linkUrl}
                  </a>
                ) : null}
                {p.file ? (
                  <a
                    href={`/api/files/${p.file.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-xs text-accent-bright hover:underline"
                  >
                    📄 {p.file.filename}
                  </a>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Link
                  href={`/courses/${p.course.slug}/board/${p.id}`}
                  className="btn btn-ghost btn-sm text-[10px]"
                >
                  Open
                </Link>
                <form action={setBoardPostHidden}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="hidden" value={p.hidden ? "false" : "true"} />
                  <button type="submit" className={HIDE_BTN(p.hidden)}>
                    {p.hidden ? "Unhide" : "Hide"}
                  </button>
                </form>
                <form action={adminDeleteBoardPost}>
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className={DEL_BTN}>
                    Delete
                  </button>
                </form>
              </div>
            </div>

            {p.replies.length ? (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                {p.replies.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-start justify-between gap-3 border-l-2 pl-3 ${
                      r.hidden ? "border-gold/50 opacity-60" : "border-border"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-muted">
                        <span className="text-foreground">{r.author.name}</span>
                        {r.staff ? <span className="ml-1.5 text-gold">Instructor</span> : null}
                        {" · "}
                        {fmt(r.createdAt)}
                        {r.hidden ? <span className="ml-1.5 text-gold">(hidden)</span> : null}
                      </p>
                      <p className="mt-0.5 whitespace-pre-line text-sm">{r.body}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <form action={setBoardReplyHidden}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="hidden" value={r.hidden ? "false" : "true"} />
                        <button type="submit" className={HIDE_BTN(r.hidden)}>
                          {r.hidden ? "Unhide" : "Hide"}
                        </button>
                      </form>
                      <form action={adminDeleteBoardReply}>
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className={DEL_BTN}>
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {!p.hidden ? (
              <form action={adminBoardReply} className="mt-3 flex gap-2 border-t border-border pt-3">
                <input type="hidden" name="postId" value={p.id} />
                <input
                  name="body"
                  className="field flex-1 text-sm"
                  placeholder={`Reply to ${p.author.name} as instructor…`}
                  required
                />
                <button type="submit" className="btn btn-primary btn-sm">
                  Reply
                </button>
              </form>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
