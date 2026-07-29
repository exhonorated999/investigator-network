"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type FormState } from "../actions";
import { Field, SubmitButton } from "@/components/form";

const initialState: FormState = { ok: false };

export default function RegisterPage() {
  const [state, formAction] = useActionState(registerAction, initialState);

  if (state.ok) {
    return (
      <div className="text-center">
        <p className="eyebrow eyebrow-gold">// Status: pending</p>
        <h1 className="display-lg mt-2">Request received</h1>
        <div className="mt-5 border border-success/40 bg-[rgba(74,222,128,0.08)] px-4 py-4">
          <p className="text-sm text-foreground">{state.message}</p>
        </div>
        <Link href="/login" className="btn btn-ghost btn-sm mt-6">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow eyebrow-gold">// Request access</p>
      <h1 className="display-lg mt-2">Request access</h1>
      <p className="mt-3 text-sm text-muted">
        Registrations are reviewed and approved by an administrator before access
        is granted.
      </p>

      <div className="mt-4 border border-gold/30 bg-[rgba(244,162,97,0.06)] px-4 py-2.5">
        <p className="font-mono text-[11px] text-gold">
          <span className="opacity-60">// </span>
          ADMIN APPROVAL REQUIRED — NO IMMEDIATE ACCESS
        </p>
      </div>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <Field
          label="Full name"
          name="name"
          autoComplete="name"
          error={state.fieldErrors?.name}
        />
        <Field
          label="Agency / department"
          name="agency"
          autoComplete="organization"
          error={state.fieldErrors?.agency}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          error={state.fieldErrors?.email}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          error={state.fieldErrors?.password}
        />
        <SubmitButton label="Request access" />
      </form>

      <p className="mt-6 text-center font-mono text-xs text-muted">
        Already approved?{" "}
        <Link
          href="/login"
          className="text-accent-bright transition hover:text-accent"
        >
          Sign in →
        </Link>
      </p>
    </div>
  );
}
