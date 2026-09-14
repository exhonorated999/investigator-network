"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction, type FormState } from "../actions";
import { Field, SubmitButton } from "@/components/form";

const initialState: FormState = { ok: false };

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState(forgotPasswordAction, initialState);

  return (
    <div>
      <p className="eyebrow eyebrow-gold">// Password reset</p>
      <h1 className="display-lg mt-2">Forgot your password?</h1>
      <p className="mt-3 text-sm text-muted">
        Enter the email on your account and we&apos;ll send you a link to set a new
        password.
      </p>

      {state.message ? (
        <div
          className={
            state.ok
              ? "mt-5 border border-success/40 bg-[rgba(34,197,94,0.08)] px-4 py-3"
              : "mt-5 border border-danger/40 bg-[rgba(239,68,68,0.08)] px-4 py-3"
          }
        >
          <p
            className={`font-mono text-xs ${
              state.ok ? "text-success" : "text-danger"
            }`}
          >
            <span className="opacity-60">// </span>
            {state.message}
          </p>
        </div>
      ) : null}

      {!state.ok && (
        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <Field label="Email" name="email" type="email" autoComplete="email" />
          <SubmitButton label="Send reset link" />
        </form>
      )}

      <p className="mt-6 text-center font-mono text-xs text-muted">
        <Link
          href="/login"
          className="text-accent-bright transition hover:text-accent"
        >
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}
