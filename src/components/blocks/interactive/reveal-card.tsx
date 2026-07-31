"use client";

import { useState } from "react";
import type { RevealCardBlock } from "@/lib/blocks";

/**
 * Reveal card client component.
 *
 * Shows the front text; click to flip and reveal the back (pre-rendered HTML
 * passed as a prop so marked stays on the server).
 */
export function RevealCardBlockView({
  block,
  backHtml,
}: {
  block: RevealCardBlock;
  /** Pre-rendered HTML string for the back face. */
  backHtml: string;
}) {
  const front = block.front.trim();
  const [revealed, setRevealed] = useState(false);

  if (!front && !backHtml) return null;

  return (
    <div className="panel rule-top overflow-hidden">
      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-[rgba(0,180,216,0.04)]"
        >
          <span className="flex items-center gap-3">
            <span className="font-mono text-sm text-accent" aria-hidden>
              ⇄
            </span>
            <span className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
              {front || "Click to reveal"}
            </span>
          </span>
          <span className="eyebrow whitespace-nowrap">Reveal →</span>
        </button>
      ) : (
        <div className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="font-mono text-sm text-success" aria-hidden>
              ✓
            </span>
            <span className="eyebrow text-success">REVEALED</span>
          </div>
          {front ? (
            <p className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted">
              {front}
            </p>
          ) : null}
          {backHtml ? (
            <div
              className="text-sm text-foreground [&_a]:text-accent [&_a]:underline [&_p]:my-2 [&_p]:max-w-[68ch] [&_strong]:text-foreground [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_code]:text-accent-bright [&_ul]:my-2 [&_ul]:list-none [&_li]:my-1 [&_li]:relative [&_li]:pl-5 [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:text-accent [&_li]:before:content-['▸']"
              dangerouslySetInnerHTML={{ __html: backHtml }}
            />
          ) : null}
          <button
            type="button"
            onClick={() => setRevealed(false)}
            className="btn btn-ghost btn-sm mt-4"
          >
            ← Hide
          </button>
        </div>
      )}
    </div>
  );
}
