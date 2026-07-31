"use client";

import type { RevealCardBlock } from "@/lib/blocks";
import { useInteractions } from "@/components/blocks/interaction-store";
import { PROSE_INLINE } from "@/components/blocks/prose";

/**
 * Reveal card client component.
 *
 * Shows the front text; click to flip and reveal the back (pre-rendered HTML
 * passed as a prop so marked stays on the server). The revealed state is
 * persisted to the server via the interaction store and seeded from it on
 * mount.
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
  const { answers, save } = useInteractions();

  // Seed revealed state from the store.
  const revealed = answers[block.id]?.payload.revealed === true;

  if (!front && !backHtml) return null;

  // Required edge treatment.
  const requiredEdge = block.required
    ? revealed
      ? "border-l-2 border-l-success"
      : "border-l-2 border-l-gold"
    : "";

  const handleReveal = () => {
    save(block.id, { revealed: true });
  };

  return (
    <div className={`panel rule-top overflow-hidden ${requiredEdge}`}>
      {!revealed ? (
        <button
          type="button"
          onClick={handleReveal}
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
          <span className="flex items-center gap-3">
            {block.required ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
                REQUIRED
              </span>
            ) : null}
            <span className="eyebrow whitespace-nowrap">Reveal →</span>
          </span>
        </button>
      ) : (
        <div className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="font-mono text-sm text-success" aria-hidden>
              ✓
            </span>
            <span className="eyebrow text-success">REVEALED</span>
            {block.required ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-success">
                REQUIRED
              </span>
            ) : null}
          </div>
          {front ? (
            <p className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted">
              {front}
            </p>
          ) : null}
          {backHtml ? (
            <div
              className={`text-sm ${PROSE_INLINE}`}
              dangerouslySetInnerHTML={{ __html: backHtml }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
