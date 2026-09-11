"use client";

import { useTransition } from "react";
import { addCard } from "@/app/dashboard/actions";

/**
 * Appends a new empty card to the canvas; the learner then picks a widget.
 * `inline` renders a compact button (for the section header); default renders
 * a full-width dashed drop-zone tile at the end of the grid.
 */
export function AddCardButton({ variant = "tile" }: { variant?: "tile" | "inline" }) {
  const [pending, startTransition] = useTransition();
  const add = () => startTransition(async () => { await addCard(); });

  if (variant === "inline") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={add}
        className="btn btn-primary btn-sm inline-flex items-center gap-2 disabled:opacity-50"
      >
        <span className="text-base leading-none">+</span>
        {pending ? "Adding…" : "Add a card"}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={add}
      className="flex min-h-[96px] w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-border-strong p-5 text-muted transition hover:border-accent-bright hover:text-accent-bright disabled:opacity-50"
    >
      <span className="grid h-9 w-9 place-items-center rounded-full border border-border-strong text-lg leading-none">
        +
      </span>
      <span className="eyebrow eyebrow-muted text-[10px]">
        {pending ? "Adding…" : "Add a card to your dashboard"}
      </span>
    </button>
  );
}
