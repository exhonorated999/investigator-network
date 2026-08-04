"use client";

import { useActionState } from "react";
import { changePasswordAction, type ChangePasswordState } from "./actions";
import { Field, SubmitButton } from "@/components/form";

const initial: ChangePasswordState = { ok: false };

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, initial);

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
        <Field
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
        />
        <Field
          label="Confirm new password"
          name="confirm"
          type="password"
          autoComplete="new-password"
        />
        <p className="font-mono text-[10px] leading-relaxed text-muted">
          <span className="opacity-60">// </span>
          At least 8 characters. Use something you don&apos;t use elsewhere.
        </p>
        <SubmitButton label="Set my password" />
      </form>
    </>
  );
}
