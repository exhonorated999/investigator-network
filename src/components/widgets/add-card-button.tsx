"use client";

import { useTransition } from "react";
import { addCard } from "@/app/dashboard/actions";

/** Appends a new empty card to the canvas; the learner then picks a widget. */
export function AddCardButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => { await addCard(); })}
      className="flex min-h-[120px] w-full flex-col items-center justify-center gap-2 border border-dashed border-border p-5 text-muted transition hover:border-accent-bright hover:text-accent-bright disabled:opacity-50"
    >
      <span className="grid h-9 w-9 place-items-center rounded-full border border-border-strong text-lg leading-none">
        +
      </span>
      <span className="eyebrow eyebrow-muted text-[10px]">
        {pending ? "Adding…" : "Add a card"}
      </span>
    </button>
  );
}
