"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { registerAction, type FormState } from "../actions";
import { Field, SubmitButton } from "@/components/form";

const initialState: FormState = { ok: false };

export default function RegisterPage() {
  const [state, formAction] = useActionState(registerAction, initialState);
  const [audience, setAudience] = useState<"LE" | "CIVILIAN">("LE");

  if (state.ok) {
    const approved = state.autoApproved;
    return (
      <div className="text-center">
        <p className={`eyebrow ${approved ? "eyebrow-gold" : "eyebrow-gold"}`}>
          {approved ? "// Status: approved" : "// Status: pending"}
        </p>
        <h1 className="display-lg mt-2">
          {approved ? "You're in" : "Request received"}
        </h1>
        <div
          className={`mt-5 border px-4 py-4 ${
            approved
              ? "border-success/40 bg-[rgba(74,222,128,0.08)]"
              : "border-gold/40 bg-[rgba(244,162,97,0.08)]"
          }`}
        >
          <p className="text-sm text-foreground">{state.message}</p>
        </div>
        <Link
          href="/login"
          className={`btn btn-sm mt-6 ${approved ? "btn-primary" : "btn-ghost"}`}
        >
          {approved ? "Sign in →" : "Back to sign in"}
        </Link>
      </div>
    );
  }

  const isLE = audience === "LE";

  return (
    <div>
      <p className="eyebrow eyebrow-gold">// Request access</p>
      <h1 className="display-lg mt-2">Request access</h1>
      <p className="mt-3 text-sm text-muted">
        Civilian investigators and law-enforcement officers with a verified
        <span className="font-mono text-foreground"> .gov </span>
        email are approved instantly. Other law-enforcement requests are
        reviewed by an administrator.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        {/* Audience segmented control */}
        <input type="hidden" name="audience" value={audience} />
        <div className="flex flex-col gap-2">
          <span className="eyebrow eyebrow-muted">I am registering as</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAudience("LE")}
              aria-pressed={isLE}
              className={`btn btn-sm ${isLE ? "btn-primary" : "btn-ghost"}`}
            >
              Law enforcement
            </button>
            <button
              type="button"
              onClick={() => setAudience("CIVILIAN")}
              aria-pressed={!isLE}
              className={`btn btn-sm ${!isLE ? "btn-primary" : "btn-ghost"}`}
            >
              Civilian investigator
            </button>
          </div>
          {state.fieldErrors?.audience ? (
            <p className="font-mono text-xs text-danger" role="alert">
              <span className="opacity-60">// </span>
              {state.fieldErrors.audience}
            </p>
          ) : null}
        </div>

        <Field
          label="Full name"
          name="name"
          autoComplete="name"
          error={state.fieldErrors?.name}
        />
        <Field
          label={
            isLE ? "Agency / department" : "Business / firm (if applicable)"
          }
          name="agency"
          autoComplete="organization"
          error={state.fieldErrors?.agency}
        />
        <Field
          label="State"
          name="state"
          autoComplete="address-level1"
          error={state.fieldErrors?.state}
        />
        <Field
          label={isLE ? "Email (.gov for instant approval)" : "Email"}
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
