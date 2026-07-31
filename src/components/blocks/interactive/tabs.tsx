"use client";

import { useState, useRef, type ReactNode, type KeyboardEvent } from "react";
import type { TabsBlock } from "@/lib/blocks";

/**
 * Tabs client shell.
 *
 * The panel content (nested blocks) is rendered server-side by the parent and
 * passed as `children` per tab, so marked never enters the client bundle.
 *
 * Implements proper ARIA tablist semantics: role=tablist/tab/tabpanel,
 * aria-selected, and arrow-key navigation.
 */
export function TabsBlockView({
  block,
  children,
}: {
  block: TabsBlock;
  /** Pre-rendered panel content, one ReactNode per tab. */
  children: ReactNode[];
}) {
  const items = block.items;
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (!items.length) return null;

  const safeActive = Math.min(active, items.length - 1);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = (safeActive + 1) % items.length;
      setActive(next);
      tabRefs.current[next]?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (safeActive - 1 + items.length) % items.length;
      setActive(prev);
      tabRefs.current[prev]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
      tabRefs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(items.length - 1);
      tabRefs.current[items.length - 1]?.focus();
    }
  };

  return (
    <div className="panel rule-top">
      <div
        role="tablist"
        aria-label="Section tabs"
        className="flex flex-wrap border-b border-border"
      >
        {items.map((item, i) => {
          const label = item.label.trim() || `Tab ${i + 1}`;
          const isActive = i === safeActive;
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={isActive}
              aria-controls={`tabpanel-${item.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={onKeyDown}
              className={`border-b-2 px-4 py-3 font-display text-xs font-semibold uppercase tracking-wide transition ${
                isActive
                  ? "border-accent text-accent-bright"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {items.map((item, i) => {
        const isActive = i === safeActive;
        if (!isActive) return null;
        return (
          <div
            key={item.id}
            role="tabpanel"
            id={`tabpanel-${item.id}`}
            aria-labelledby={`tab-${item.id}`}
            className="p-5"
          >
            {children[i]}
          </div>
        );
      })}
    </div>
  );
}
