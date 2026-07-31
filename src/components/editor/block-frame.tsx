"use client";

import { type ReactNode, useState } from "react";
import { BLOCK_LABEL, type Block } from "@/lib/blocks";
import { useEditor } from "./editor-store";

/**
 * Chrome around one block on the canvas.
 *
 * Everything here is deliberately quiet until you interact. The old builder
 * gave every block a permanent header bar with four buttons, which meant a
 * 30-block page was mostly UI furniture. Here the block renders as it will for
 * the learner, and the controls fade in on hover or when selected.
 *
 * The drag handle is a separate element rather than making the whole block
 * draggable, because the block contains text inputs and a draggable ancestor
 * makes selecting text with the mouse impossible.
 */
export function BlockFrame({
  block,
  onDragStart,
  onDragEnd,
  dragging,
  children,
}: {
  block: Block;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  dragging: boolean;
  children: ReactNode;
}) {
  const { selectedId, select, remove, duplicate, nudge } = useEditor();
  const [handleGrabbed, setHandleGrabbed] = useState(false);
  const selected = selectedId === block.id;

  return (
    <div
      // Only draggable while the handle is held, so text selection inside the
      // block still works normally.
      draggable={handleGrabbed}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", block.id);
        onDragStart(block.id);
      }}
      onDragEnd={() => {
        setHandleGrabbed(false);
        onDragEnd();
      }}
      onMouseDown={() => select(block.id)}
      onFocusCapture={() => select(block.id)}
      className={`group/block relative rounded-sm transition ${
        dragging ? "opacity-40" : ""
      } ${
        selected
          ? "outline outline-1 outline-accent/70"
          : "outline outline-1 outline-transparent hover:outline-border-strong"
      }`}
    >
      {/* Type badge + handle, in the left gutter. */}
      <div className="pointer-events-none absolute -left-2 top-0 z-20 flex -translate-x-full items-center gap-1 opacity-0 transition group-hover/block:opacity-100 group-focus-within/block:opacity-100">
        <button
          type="button"
          aria-label={`Drag ${BLOCK_LABEL[block.type]} block`}
          title="Drag to move"
          onMouseDown={() => setHandleGrabbed(true)}
          onMouseUp={() => setHandleGrabbed(false)}
          className="pointer-events-auto cursor-grab border border-border bg-surface px-1.5 py-1 font-mono text-[11px] leading-none text-muted hover:border-accent hover:text-accent-bright active:cursor-grabbing"
        >
          ⠿
        </button>
      </div>

      {/* Floating toolbar, top-right. */}
      <div className="pointer-events-none absolute -top-3 right-2 z-20 flex items-center gap-1 opacity-0 transition group-hover/block:opacity-100 group-focus-within/block:opacity-100">
        <span className="pointer-events-auto border border-border bg-surface px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
          {BLOCK_LABEL[block.type]}
        </span>
        <ToolButton label={`Move ${BLOCK_LABEL[block.type]} up`} onClick={() => nudge(block.id, -1)}>
          ↑
        </ToolButton>
        <ToolButton label={`Move ${BLOCK_LABEL[block.type]} down`} onClick={() => nudge(block.id, 1)}>
          ↓
        </ToolButton>
        <ToolButton label={`Duplicate ${BLOCK_LABEL[block.type]}`} onClick={() => duplicate(block.id)}>
          ⧉
        </ToolButton>
        <ToolButton
          label={`Delete ${BLOCK_LABEL[block.type]}`}
          onClick={() => remove(block.id)}
          danger
        >
          ✕
        </ToolButton>
      </div>

      <div className="p-1">{children}</div>
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`pointer-events-auto border bg-surface px-1.5 py-0.5 font-mono text-[11px] leading-none transition ${
        danger
          ? "border-danger/40 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)]"
          : "border-border text-muted hover:border-accent hover:text-accent-bright"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * A labelled dashed region for a container's child list, so an empty column or
 * tab reads as "drop something here" rather than as a rendering bug.
 */
export function SlotFrame({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-sm border border-dashed border-border/70 p-2">
      <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted/70">
        {label}
      </p>
      {children}
    </div>
  );
}
