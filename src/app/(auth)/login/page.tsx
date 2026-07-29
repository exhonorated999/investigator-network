"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type FormState } from "../actions";
import { Field, SubmitButton } from "@/components/form";

const initialState: FormState = { ok: false };

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <div>
      <p className="eyebrow eyebrow-gold">// Secure login</p>
      <h1 className="display-lg mt-2">Sign in</h1>
      <p className="mt-3 text-sm text-muted">
        Access the Investigator Network training platform.
      </p>

      {state.message ? (
        <div className="mt-5 border border-danger/40 bg-[rgba(239,68,68,0.08)] px-4 py-3">
          <p className="font-mono text-xs text-danger">
            <span className="opacity-60">// </span>
            {state.message}
          </p>
        </div>
      ) : null}

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
        />
        <SubmitButton label="Sign in" />
      </form>

      <p className="mt-6 text-center font-mono text-xs text-muted">
        Need access?{" "}
        <Link
          href="/register"
          className="text-accent-bright transition hover:text-accent"
        >
          Request an account →
        </Link>
      </p>
    </div>
  );
}
