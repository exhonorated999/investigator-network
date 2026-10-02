"use client";

import { useRef, useState, useTransition } from "react";
import { adminReply } from "./actions";

/**
 * Inline reply composer for the moderation console. Collapsed to a "Reply"
 * button; expands to a textarea. Posts as the signed-in admin.
 */
export function ReplyBox({
  postId,
  parentId,
  replyingTo,
  compact = false,
}: {
  postId: string;
  parentId?: string;
  replyingTo?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setSent(false);
          }}
          className={`btn btn-ghost btn-sm ${compact ? "text-[10px]" : ""}`}
        >
          {parentId ? "Reply" : "Reply to post"}
        </button>
        {sent ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-success">
            ✓ Reply posted
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={(fd) =>
        start(async () => {
          await adminReply(fd);
          formRef.current?.reset();
          setOpen(false);
          setSent(true);
        })
      }
      className="mt-2 w-full"
    >
      <input type="hidden" name="postId" value={postId} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      {replyingTo ? (
        <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">
          Replying to {replyingTo}
        </p>
      ) : null}
      <textarea
        name="body"
        required
        rows={3}
        maxLength={4000}
        autoFocus
        placeholder="Write a reply — posts publicly to the community as you."
        className="field !text-[14px]"
      />
      <div className="mt-2 flex items-center gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
          {pending ? "Posting…" : "Post reply"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="btn btn-ghost btn-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
