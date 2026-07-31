"use client";

import { useState, useCallback, type DragEvent } from "react";
import type { OrderingBlock } from "@/lib/blocks";
import { isInteractionComplete } from "@/lib/blocks";
import { useInteractions } from "@/components/blocks/interaction-store";
import { PROSE_INLINE } from "@/components/blocks/prose";

/**
 * Deterministic seeded PRNG so the shuffle is stable across renders and
 * visits — no hydration mismatch, no Math.random at render time.
 */

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle using a seeded PRNG. */
function seededShuffle<T>(items: T[], seed: string): T[] {
  if (items.length < 2) return [...items];
  const rng = mulberry32(hashSeed(seed));
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // Guard against the shuffle accidentally producing the correct order.
  const isSame = out.every((item, i) => item === items[i]);
  if (isSame && out.length >= 2) {
    [out[0], out[1]] = [out[1], out[0]];
  }
  return out;
}

/**
 * Ordering client component.
 *
 * Drag shuffled steps back into the correct sequence. The authored order IS
 * the correct order. Drag-and-drop works with mouse (HTML5 DnD) and keyboard
 * (always-visible ↑/↓ buttons). The arrangement is persisted to the server
 * via the interaction store on every change.
 */
export function OrderingBlockView({
  block,
  promptHtml,
}: {
  block: OrderingBlock;
  /** Pre-rendered HTML string for the prompt. */
  promptHtml: string;
}) {
  const items = block.items.filter((it) => it.text.trim());
  const title = block.title.trim();
  const { answers, save } = useInteractions();

  // The correct order is the authored order.
  const correctOrder = items.map((it) => it.id);

  // Determine the initial arrangement: seeded shuffle, unless the store has
  // a saved order with exactly the same id set.
  const savedOrder = answers[block.id]?.payload.order;
  const savedSet = new Set(savedOrder ?? []);
  const currentSet = new Set(correctOrder);
  const savedIsValid =
    savedOrder &&
    savedOrder.length === correctOrder.length &&
    correctOrder.every((id) => savedSet.has(id)) &&
    savedOrder.every((id) => currentSet.has(id));

  const shuffledIds = seededShuffle(correctOrder, block.id);
  const initialOrder = savedIsValid ? savedOrder! : shuffledIds;

  const [order, setOrder] = useState<string[]>(initialOrder);
  const [checked, setChecked] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  if (!promptHtml || items.length < 2) return null;

  const isCorrect = isInteractionComplete(block, { order });

  // Required edge treatment.
  const satisfied = block.required ? checked && isCorrect : false;
  const requiredEdge = block.required
    ? satisfied
      ? "border-l-2 border-l-success"
      : "border-l-2 border-l-gold"
    : "";

  const persist = useCallback(
    (next: string[]) => {
      setOrder(next);
      save(block.id, { order: next });
    },
    [block.id, save],
  );

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    persist(next);
    setChecked(false);
  };

  const onDragStart = (e: DragEvent<HTMLLIElement>, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Firefox requires setData to start a drag.
    try {
      e.dataTransfer.setData("text/plain", String(index));
    } catch {
      // Some browsers throw on setData — ignore.
    }
  };

  const onDragOver = (e: DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDrop = (e: DragEvent<HTMLLIElement>, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      return;
    }
    move(dragIndex, dropIndex);
    setDragIndex(null);
  };

  const onDragEnd = () => {
    setDragIndex(null);
  };

  const reset = () => {
    persist(shuffledIds);
    setChecked(false);
  };

  return (
    <div className={`panel rule-top p-5 ${requiredEdge}`}>
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <span className="font-mono text-sm text-accent" aria-hidden>
          ⇅
        </span>
        <span className="eyebrow eyebrow-muted">
          PUT IN ORDER
          {block.required ? " · REQUIRED" : ""}
        </span>
      </div>
      {title ? (
        <h3 className="mb-3 font-display text-lg font-bold uppercase tracking-wide text-accent-bright">
          {title}
        </h3>
      ) : null}

      {/* Prompt */}
      <div
        className={`mb-5 text-sm ${PROSE_INLINE}`}
        dangerouslySetInnerHTML={{ __html: promptHtml }}
      />

      {/* Ordered list */}
      <ol className="grid gap-2">
        {order.map((id, index) => {
          const item = items.find((it) => it.id === id);
          if (!item) return null;

          const isDragging = dragIndex === index;
          let rowClass = "border-border bg-surface-2 hover:border-accent/30";

          if (checked) {
            const correctSlot = correctOrder[index] === id;
            rowClass = correctSlot
              ? "border-success bg-[rgba(74,222,128,0.06)]"
              : "border-danger bg-[rgba(239,68,68,0.06)]";
          }

          if (isDragging) {
            rowClass += " opacity-40";
          }

          return (
            <li
              key={id}
              draggable={!checked}
              onDragStart={(e) => onDragStart(e, index)}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, index)}
              onDragEnd={onDragEnd}
              className={`flex items-center gap-3 border p-3 transition ${rowClass} ${
                !checked
                  ? "cursor-grab active:cursor-grabbing focus-within:ring-2 focus-within:ring-accent"
                  : ""
              }`}
            >
              {/* Position number */}
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center border border-border-strong font-mono text-xs font-bold text-muted"
                aria-hidden
              >
                {index + 1}
              </span>

              {/* Grip affordance */}
              <span
                className="shrink-0 cursor-grab font-mono text-sm text-muted select-none active:cursor-grabbing"
                aria-hidden
              >
                ⠿
              </span>

              {/* Text */}
              <span className="flex-1 text-sm text-foreground">
                {item.text}
              </span>

              {/* Per-row correctness indicator */}
              {checked ? (
                <span
                  className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] ${
                    correctOrder[index] === id
                      ? "text-success"
                      : "text-danger"
                  }`}
                  aria-hidden
                >
                  {correctOrder[index] === id ? "✓" : "✖"}
                </span>
              ) : null}

              {/* Keyboard controls — always visible */}
              <div className="flex shrink-0 gap-1" role="group" aria-label={`Move item ${index + 1}`}>
                <button
                  type="button"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0 || checked}
                  aria-label={`Move item ${index + 1} up`}
                  className="flex h-6 w-6 items-center justify-center border border-border-strong text-muted transition hover:border-accent hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30 disabled:hover:border-border-strong disabled:hover:text-muted"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={index === order.length - 1 || checked}
                  aria-label={`Move item ${index + 1} down`}
                  className="flex h-6 w-6 items-center justify-center border border-border-strong text-muted transition hover:border-accent hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30 disabled:hover:border-border-strong disabled:hover:text-muted"
                >
                  ↓
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Controls */}
      <div className="mt-4 flex items-center gap-3">
        {!checked ? (
          <button
            type="button"
            onClick={() => setChecked(true)}
            className="btn btn-primary btn-sm"
          >
            Check order
          </button>
        ) : (
          <button
            type="button"
            onClick={reset}
            className="btn btn-ghost btn-sm"
          >
            ↻ Try again
          </button>
        )}
        {checked ? (
          <span
            className={`font-mono text-xs uppercase tracking-[0.14em] ${
              isCorrect ? "text-success" : "text-danger"
            }`}
            aria-live="polite"
          >
            {isCorrect
              ? "✓ Correct order"
              : "✖ Not yet — items in wrong slots are marked red"}
          </span>
        ) : null}
      </div>
    </div>
  );
}
