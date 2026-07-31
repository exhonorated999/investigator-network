"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChecklistBlock } from "@/lib/blocks";

/**
 * Checklist client component.
 *
 * Tickable items with state persisted to localStorage, keyed by the block id.
 * Must not crash during SSR — localStorage access is guarded in an effect, not
 * during render.
 */
export function ChecklistBlockView({ block }: { block: ChecklistBlock }) {
  const items = block.items.filter((it) => it.text.trim());
  const title = block.title.trim();
  const storageKey = `checklist:${block.id}`;

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  // Load from localStorage after mount — never during render/SSR.
  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        setChecked(new Set(ids));
      }
    } catch {
      // localStorage may be disabled or the JSON corrupt — silently ignore.
    }
  }, [storageKey]);

  // Persist on change.
  const toggle = useCallback(
    (id: string) => {
      setChecked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          localStorage.setItem(storageKey, JSON.stringify([...next]));
        } catch {
          // Ignore write failures.
        }
        return next;
      });
    },
    [storageKey],
  );

  if (!items.length) return null;

  const completed = mounted ? checked.size : 0;
  const total = items.length;

  return (
    <div className="panel rule-top p-5">
      <div className="mb-4 flex items-center justify-between">
        {title ? (
          <span className="tag-chip">// {title.toUpperCase()}</span>
        ) : (
          <span className="eyebrow eyebrow-muted">CHECKLIST</span>
        )}
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          {completed} / {total} complete
        </span>
      </div>
      <ul className="grid gap-2">
        {items.map((item) => {
          const isChecked = mounted && checked.has(item.id);
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
