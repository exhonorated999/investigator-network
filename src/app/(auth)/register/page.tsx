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
        <h1 className="text-xl font-semibold text-foreground mb-3">
          Thanks for registering
        </h1>
        <p className="text-muted">{state.message}</p>
        <Link
          href="/login"
          className="mt-6 inline-block text-accent hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-1">
        Request access
      </h1>
      <p className="text-sm text-muted mb-6">
        Registrations are reviewed and approved by an administrator before access
        is granted.
      </p>

      <form action={formAction} className="flex flex-col gap-4">
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

      <p className="mt-6 text-center text-sm text-muted">
        Already approved?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
