"use client";

import { useState, useTransition, type ReactNode } from "react";
import { setSlot } from "@/app/dashboard/actions";
import { SLOT_CHOICES, slotLabel, type SlotChoice } from "@/lib/dashboard";

/**
 * A positioned dashboard slot. We own the geometry; the learner picks what
 * fills it via the gear in the corner. `children` is the server-rendered widget
 * for the current choice (null when empty).
 */
export function SlotCard({
  index,
  choice,
  children,
}: {
  index: number;
  choice: SlotChoice;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isEmpty = choice === "empty";

  function pick(choiceId: string) {
    // Call the server action directly instead of relying on native form
    // submission — closing the menu unmounts the <form> synchronously, which
    // would otherwise cancel the submit ("form is not connected").
    const fd = new FormData();
    fd.set("index", String(index));
    fd.set("choice", choiceId);
    startTransition(async () => {
      await setSlot(fd);
    });
    setOpen(false);
  }

  return (
    <div className="relative h-full">
      {/* click-away shield */}
      {open ? (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      {/* picker */}
      <div className="absolute -top-3 right-3 z-50">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Choose card"
          aria-expanded={open}
          className="grid h-7 w-7 place-items-center border border-border-strong bg-surface text-muted shadow-[0_4px_14px_-4px_rgba(0,0,0,0.6)] transition hover:border-accent-bright hover:text-accent-bright"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {open ? (
          <div
            className="panel absolute right-0 z-50 mt-2 w-56 p-1.5"
            style={{ boxShadow: "0 24px 60px -20px rgba(0,0,0,0.85)" }}
          >
            <p className="eyebrow eyebrow-muted px-2 py-1.5 text-[9px]">
              Show in this card
            </p>
            <div className="max-h-72 overflow-y-auto">
              {SLOT_CHOICES.map((c) => {
                const active = c.id === choice;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={pending}
                    onClick={() => pick(c.id)}
                    className={`flex w-full items-center justify-between gap-2 px-2 py-2 text-left font-display text-[11px] font-bold uppercase tracking-[0.12em] transition disabled:opacity-50 ${
                      active
                        ? "bg-[rgba(0,180,216,0.16)] text-accent-bright"
                        : "text-muted hover:bg-[rgba(0,180,216,0.06)] hover:text-foreground"
                    }`}
                  >
                    {c.label}
                    {active ? <span className="text-accent-bright">✓</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* content */}
      {isEmpty ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-2 border border-dashed border-border p-5 text-muted transition hover:border-accent-bright hover:text-accent-bright"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full border border-border-strong text-lg leading-none">
            +
          </span>
          <span className="eyebrow eyebrow-muted text-[10px]">Add a card</span>
        </button>
      ) : (
        <div className="h-full" title={slotLabel(choice)}>
          {children}
        </div>
      )}
    </div>
  );
}
