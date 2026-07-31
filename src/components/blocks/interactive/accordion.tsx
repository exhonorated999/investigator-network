"use client";

import { useState, type ReactNode } from "react";
import type { AccordionBlock } from "@/lib/blocks";

/**
 * Accordion client shell.
 *
 * Non-exclusive mode uses native `<details>/<summary>` — accessible for free,
 * no JS needed. Exclusive mode (only one panel open at a time) requires JS
 * state to close siblings, so we manage open-state with useState and render
 * divs with button toggles.
 *
 * The panel content (nested blocks) is rendered server-side by the parent and
 * passed as `children` per item, so marked never enters the client bundle.
 */
export function AccordionBlockView({
  block,
  children,
}: {
  block: AccordionBlock;
  /** Pre-rendered panel content, one ReactNode per item. */
  children: ReactNode[];
}) {
  const title = block.title.trim();
  const items = block.items;

  // Track open state only for exclusive mode.
  const [openIndex, setOpenIndex] = useState<number>(() => {
    if (!block.exclusive) return -1;
    const firstOpen = items.findIndex((it) => it.open);
    return firstOpen >= 0 ? firstOpen : -1;
  });

  if (!items.length) return null;

  return (
    <div className="panel rule-top">
      {title ? (
        <div className="border-b border-border px-5 py-3">
          <span className="tag-chip">// {title.toUpperCase()}</span>
        </div>
      ) : null}
      <div className="divide-y divide-border">
        {items.map((item, i) => {
          const itemTitle = item.title.trim() || `Panel ${i + 1}`;
          const content = children[i];

          if (block.exclusive) {
            const isOpen = openIndex === i;
            return (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? -1 : i)}
                  className="flex w-full items-center justify-between px-5 py-3 text-left transition hover:bg-[rgba(0,180,216,0.04)]"
                  aria-expanded={isOpen}
                >
                  <span className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
                    {itemTitle}
                  </span>
                  <span
                    className="font-mono text-sm text-accent transition-transform"
                    style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
                    aria-hidden
                  >
                    ▸
                  </span>
                </button>
                {isOpen && content ? (
                  <div className="border-t border-border px-5 py-4">{content}</div>
                ) : null}
              </div>
            );
          }

          // Non-exclusive: native <details> — no JS.
          return (
            <details key={item.id} open={item.open}>
              <summary className="flex cursor-pointer items-center justify-between px-5 py-3 transition hover:bg-[rgba(0,180,216,0.04)] [&::-webkit-details-marker]:hidden">
                <span className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
                  {itemTitle}
                </span>
                <span className="font-mono text-sm text-accent" aria-hidden>
                  ▸
                </span>
              </summary>
              <div className="border-t border-border px-5 py-4">{content}</div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
