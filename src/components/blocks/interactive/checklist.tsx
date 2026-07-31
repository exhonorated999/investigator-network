"use client";

import { useCallback } from "react";
import type { ChecklistBlock } from "@/lib/blocks";
import { useInteractions } from "@/components/blocks/interaction-store";

/**
 * Checklist client component.
 *
 * Tickable items with state persisted to the server via the interaction store.
 * Initial ticks arrive from the provider (seeded with server data), so there is
 * no hydration mismatch to guard against. The store is already optimistic, so
 * no local state is needed — ticks are derived directly from the store and
 * written back on every toggle.
 */
export function ChecklistBlockView({ block }: { block: ChecklistBlock }) {
  const items = block.items.filter((it) => it.text.trim());
  const title = block.title.trim();
  const { answers, save } = useInteractions();

  // Derive checked set from the store on every render — no local copy.
  const checkedIds = answers[block.id]?.payload.checked ?? [];
  const checked = new Set(checkedIds);

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(checked);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      save(block.id, { checked: [...next] });
    },
    [block.id, checked, save],
  );

  if (!items.length) return null;

  const completed = checked.size;
  const total = items.length;
  const allDone = completed === total;

  // Required edge treatment: amber when outstanding, green when satisfied.
  const requiredEdge = block.required
    ? allDone
      ? "border-l-2 border-l-success"
      : "border-l-2 border-l-gold"
    : "";

  return (
    <div className={`panel rule-top p-5 ${requiredEdge}`}>
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2">
          {title ? (
            <span className="tag-chip">// {title.toUpperCase()}</span>
          ) : (
            <span className="eyebrow eyebrow-muted">CHECKLIST</span>
          )}
          {block.required ? (
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                allDone ? "text-success" : "text-gold"
              }`}
            >
              REQUIRED
            </span>
          ) : null}
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          {completed} / {total} complete
        </span>
      </div>
      <ul className="grid gap-2">
        {items.map((item) => {
          const isChecked = checked.has(item.id);
          return (
            <li key={item.id}>
              <label
                className={`flex cursor-pointer items-start gap-3 border p-3 transition ${
                  isChecked
                    ? "border-success/40 bg-[rgba(74,222,128,0.04)]"
                    : "border-border bg-surface-2 hover:border-accent/30"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-xs transition ${
                    isChecked
                      ? "border-success bg-success/20 text-success"
                      : "border-border-strong text-transparent"
                  }`}
                  aria-hidden
                >
                  ✓
                </span>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(item.id)}
                  className="sr-only"
                />
                <span
                  className={`text-sm ${
                    isChecked
                      ? "text-muted line-through"
                      : "text-foreground"
                  }`}
                >
                  {item.text}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
