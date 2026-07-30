"use client";

import { useState } from "react";
import { saveNewsTopics } from "@/app/dashboard/actions";
import type { Topic } from "@/lib/news";

/**
 * Per-learner topic subscription popover, anchored inside the news card header.
 * Nothing selected == everything, which we say out loud so the empty state
 * doesn't read as broken.
 */
export function TopicPicker({
  topics,
  selected,
}: {
  topics: Topic[];
  selected: string[];
}) {
  const [open, setOpen] = useState(false);
  const on = new Set(selected);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition hover:border-border-strong hover:text-accent-bright"
      >
        {open ? "Close" : "Topics"}
      </button>

      {open ? (
        <div
          className="panel absolute right-0 z-40 mt-2 w-[min(88vw,22rem)] p-4"
          style={{ boxShadow: "0 24px 60px -20px rgba(0,0,0,0.85)" }}
        >
          <p className="eyebrow eyebrow-gold">Filter</p>
          <h3 className="display-sm mt-2 text-[1rem]">Follow topics</h3>
          <p className="mt-2 text-sm text-muted">
            Select nothing to see every topic.
          </p>

          <form action={saveNewsTopics} className="mt-3">
            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {topics.length === 0 ? (
                <p className="text-sm text-muted">
                  No topics yet — staff create them when they file the first
                  article.
                </p>
              ) : (
                topics.map((t) => (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center justify-between gap-3 border border-transparent px-2 py-1.5 transition hover:border-border hover:bg-[rgba(0,180,216,0.05)]"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <input
                        type="checkbox"
                        name="topic"
                        value={t.id}
                        defaultChecked={on.has(t.id)}
                        className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                      />
                      <span className="truncate text-[15px] text-foreground">
                        {t.name}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted">
                      {String(t.count).padStart(2, "0")}
                    </span>
                  </label>
                ))
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                Apply
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
