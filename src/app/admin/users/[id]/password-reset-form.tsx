"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resetUserPassword, type ResetPwState } from "../actions";

const initial: ResetPwState = { ok: false };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-ghost btn-sm">
      {pending ? "Resetting…" : "Reset password"}
    </button>
  );
}

export function PasswordResetForm({ userId }: { userId: string }) {
  const [state, action] = useActionState(resetUserPassword, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input
        name="password"
        type="text"
        placeholder="New temporary password"
        minLength={8}
        required
        className="field w-64"
      />
      <Submit />
      {state.message ? (
        <p
          className={`w-full font-mono text-[11px] ${
            state.ok ? "text-success" : "text-danger"
          }`}
        >
          <span className="opacity-60">// </span>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
