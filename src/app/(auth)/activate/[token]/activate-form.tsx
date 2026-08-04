"use client";

import { useActionState } from "react";
import { activateAction, type ActivateState } from "../actions";
import { Field, SubmitButton } from "@/components/form";

const initial: ActivateState = { ok: false };

export function ActivateForm({
  token,
  isReset,
}: {
  token: string;
  isReset: boolean;
}) {
  const [state, formAction] = useActionState(activateAction, initial);

  return (
    <>
      {state.message ? (
        <div className="mt-5 border border-danger/40 bg-[rgba(239,68,68,0.08)] px-4 py-3">
          <p className="font-mono text-xs text-danger">
            <span className="opacity-60">// </span>
            {state.message}
          </p>
        </div>
      ) : null}

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <Field
          label={isReset ? "New password" : "Choose a password"}
          name="password"
          type="password"
          autoComplete="new-password"
        />
        <Field
          label="Confirm password"
          name="confirm"
          type="password"
          autoComplete="new-password"
        />
        <p className="font-mono text-[10px] leading-relaxed text-muted">
          <span className="opacity-60">// </span>
          At least 8 characters. Use something you don&apos;t use elsewhere.
        </p>
        <SubmitButton label={isReset ? "Set new password" : "Activate account"} />
      </form>
    </>
  );
}
