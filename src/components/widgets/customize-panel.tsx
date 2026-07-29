"use client";

import { useState } from "react";
import { saveWidgets } from "@/app/dashboard/actions";
import { OPTIONAL_WIDGETS, type WidgetId } from "@/lib/dashboard";

/**
 * Learner-facing dashboard customiser. Permanent widgets (course library and
 * notifications) are shown as locked rows so the user understands why they
 * cannot be removed.
 */
export function CustomizePanel({ enabled }: { enabled: WidgetId[] }) {
  const [open, setOpen] = useState(false);
  const on = new Set(enabled);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost btn-sm"
        aria-expanded={open}
      >
        {open ? "Close" : "Customize"}
      </button>

      {open ? (
        <div
          className="panel absolute right-0 z-40 mt-3 w-[min(92vw,26rem)] p-5"
          style={{ boxShadow: "0 24px 60px -20px rgba(0,0,0,0.85)" }}
        >
          <p className="eyebrow eyebrow-gold">Layout</p>
          <h3 className="display-sm mt-2 text-[1.05rem]">Your cards</h3>
          <p className="mt-2 text-sm text-muted">
            Choose what appears on your dashboard. Saved to your account.
          </p>

          <form action={saveWidgets} className="mt-4 space-y-2">
            <label className="flex items-start gap-3 border border-border bg-[rgba(255,255,255,0.02)] p-3 opacity-60">
              <span className="mt-0.5 font-mono text-[11px] text-muted">🔒</span>
              <span>
                <span className="block font-display text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                  Course library + Notifications
                </span>
                <span className="mt-1 block text-sm text-muted">
                  Always shown.
                </span>
              </span>
            </label>

            {OPTIONAL_WIDGETS.map((w) => (
              <label
                key={w.id}
                className="flex cursor-pointer items-start gap-3 border border-border p-3 transition hover:border-border-strong hover:bg-[rgba(0,180,216,0.05)]"
              >
                <input
                  type="checkbox"
                  name="widget"
                  value={w.id}
                  defaultChecked={on.has(w.id)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">
                      {w.label}
                    </span>
                    {w.comingSoon ? (
                      <span className="font-mono text-[9px] uppercase tracking-wider text-gold">
                        soon
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-sm text-muted">
                    {w.description}
                  </span>
                </span>
              </label>
            ))}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                Save layout
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
