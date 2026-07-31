"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BLOCK_CATALOG,
  BLOCK_GROUPS,
  type BlockType,
} from "@/lib/blocks";
import { type ListRef } from "@/lib/notes-doc";
import { useEditor } from "./editor-store";

/**
 * A searchable block palette.
 *
 * The old builder showed all 22 types as a flat wall of buttons behind a
 * disclosure triangle. With that many, typing two letters beats reading, so
 * search is the primary affordance and the grouped grid is the fallback for
 * browsing.
 */
export function BlockPicker({
  onPick,
  onClose,
  compact,
}: {
  onPick: (type: BlockType) => void;
  onClose: () => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      BLOCK_CATALOG.filter(
        (b) =>
          !q ||
          b.label.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          b.type.toLowerCase().includes(q)
      ),
    [q]
  );

  return (
    <div
      className="z-30 w-full max-w-2xl border border-border-strong bg-surface p-3 shadow-[0_18px_48px_rgba(0,0,0,0.45)]"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
        // Enter with exactly one match is the fast path: type "quo", press
        // Enter, get a quote block.
        if (e.key === "Enter" && matches.length === 1) {
          e.preventDefault();
          onPick(matches[0].type);
        }
      }}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search blocks…"
        aria-label="Search blocks"
        className="field w-full"
      />

      <div className="mt-3 max-h-[22rem] overflow-y-auto">
        {q ? (
          <Grid items={matches} onPick={onPick} compact={compact} />
        ) : (
          BLOCK_GROUPS.map((group) => {
            const items = BLOCK_CATALOG.filter((b) => b.group === group);
            if (!items.length) return null;
            return (
              <div key={group} className="mb-4 last:mb-0">
                <p className="eyebrow eyebrow-muted">{group}</p>
                <Grid items={items} onPick={onPick} compact={compact} />
              </div>
            );
          })
        )}
        {q && matches.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted">
            Nothing matches “{query}”.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Grid({
  items,
  onPick,
  compact,
}: {
  items: typeof BLOCK_CATALOG;
  onPick: (type: BlockType) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`mt-2 grid gap-2 ${
        compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
      }`}
    >
      {items.map((meta) => (
        <button
          key={meta.type}
          type="button"
          onClick={() => onPick(meta.type)}
          title={meta.description}
          className="flex items-start gap-2 border border-border bg-well px-3 py-2 text-left transition hover:border-accent hover:bg-[rgba(0,180,216,0.06)]"
        >
          <span className="mt-0.5 font-mono text-[13px] text-accent">
            {meta.icon}
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] text-foreground">
              {meta.label}
            </span>
            <span className="block truncate text-[11px] text-muted">
              {meta.description}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Insert point
// ---------------------------------------------------------------------------

/**
 * The gap between two blocks: a thin hover target that becomes a "+" and opens
 * the picker, and doubles as the drop zone for drag-and-drop.
 *
 * Making the gap itself the insert affordance is what removes the old builder's
 * "add at the end, then press ↑ eleven times" problem.
 */
export function InsertPoint({
  listRef,
  index,
  dragging,
  onDrop,
}: {
  listRef: ListRef;
  index: number;
  /** Id of the block currently being dragged, if any. */
  dragging: string | null;
  onDrop: (ref: ListRef, index: number) => void;
}) {
  const { insertAt } = useEditor();
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);

  if (dragging) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (!over) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          onDrop(listRef, index);
        }}
        className={`-my-1 h-4 rounded transition ${
          over ? "bg-accent/60" : "bg-transparent"
        }`}
        aria-hidden
      />
    );
  }

  if (open) {
    return (
      <div className="my-2">
        <BlockPicker
          onPick={(type) => {
            insertAt(listRef, index, type);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          compact={listRef.parentId !== null}
        />
      </div>
    );
  }

  return (
    <div className="group/insert relative -my-1 flex h-4 items-center justify-center">
      <span className="pointer-events-none absolute inset-x-0 h-px bg-accent/0 transition group-hover/insert:bg-accent/30" />
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Insert a block here"
        className="relative z-10 flex h-5 w-5 items-center justify-center border border-border bg-surface text-[12px] leading-none text-muted opacity-0 transition group-hover/insert:opacity-100 hover:border-accent hover:text-accent-bright focus-visible:opacity-100"
      >
        +
      </button>
    </div>
  );
}
