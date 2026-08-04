"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createUser, type CreateUserState } from "./actions";

const initial: CreateUserState = { ok: false };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
      {pending ? "Creating…" : "Create & approve"}
    </button>
  );
}

/**
 * Admin manual enrolment. Collapsed by default; expanding reveals the form.
 * Creating a user here approves them instantly on the chosen side, overriding
 * the normal approval gate.
 */
export function CreateUserForm({ canGrantAdmin = false }: { canGrantAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createUser, initial);
  const [audience, setAudience] = useState<"LE" | "CIVILIAN">("LE");

  return (
    <div className="mb-6 border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent-bright">
          + Manually enrol a user
        </span>
        <span className="text-muted">{open ? "–" : "+"}</span>
      </button>

      {open ? (
        <form action={action} className="grid gap-3 border-t border-border p-4 sm:grid-cols-2">
          <div className="sm:col-span-2 grid gap-2">
            <span className="eyebrow eyebrow-muted">Side</span>
            <input type="hidden" name="audience" value={audience} />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAudience("LE")}
                className={`btn btn-sm ${audience === "LE" ? "btn-primary" : "btn-ghost"}`}
              >
                Law enforcement
              </button>
              <button
                type="button"
                onClick={() => setAudience("CIVILIAN")}
                className={`btn btn-sm ${audience === "CIVILIAN" ? "btn-primary" : "btn-ghost"}`}
              >
                Civilian
              </button>
            </div>
          </div>

          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Full name</span>
            <input name="name" className="field" required />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Email</span>
            <input name="email" type="email" className="field" required />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">
              {audience === "LE" ? "Agency" : "Business (optional)"}
            </span>
            <input name="agency" className="field" />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">State</span>
            <input name="state" className="field" />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="eyebrow eyebrow-muted">Temporary password</span>
            <input name="password" type="text" className="field" required minLength={8} />
          </label>

          <label className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-wider text-muted sm:col-span-2">
            {canGrantAdmin ? (
              <>
                <input type="checkbox" name="makeAdmin" className="h-4 w-4 accent-[var(--accent)]" />
                Grant admin role
              </>
            ) : null}
          </label>

          <div className="flex items-center justify-between gap-3 sm:col-span-2">
            {state.message ? (
              <p
                className={`font-mono text-[11px] ${
                  state.ok ? "text-success" : "text-danger"
                }`}
              >
                <span className="opacity-60">// </span>
                {state.message}
              </p>
            ) : (
              <span />
            )}
            <Submit />
          </div>
        </form>
      ) : null}
    </div>
  );
}
