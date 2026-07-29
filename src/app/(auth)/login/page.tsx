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
      <h1 className="text-xl font-semibold text-foreground mb-1">Sign in</h1>
      <p className="text-sm text-muted mb-6">
        Access the Investigator Network training platform.
      </p>

      {state.message ? (
        <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-warning">
          {state.message}
        </div>
      ) : null}

      <form action={formAction} className="flex flex-col gap-4">
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
        />
        <SubmitButton label="Sign in" />
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Need access?{" "}
        <Link href="/register" className="text-accent hover:underline">
          Request an account
        </Link>
      </p>
    </div>
  );
}
