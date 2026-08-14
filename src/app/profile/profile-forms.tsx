"use client";

import { useActionState } from "react";
import {
  updateProfileAction,
  updatePasswordAction,
  type ProfileState,
} from "./actions";
import { Field, SubmitButton } from "@/components/form";

const initial: ProfileState = { ok: false };

function Notice({ state }: { state: ProfileState }) {
  if (!state.message) return null;
  const ok = state.ok;
  return (
    <div
      className={`mt-5 border px-4 py-3 ${
        ok
          ? "border-accent/40 bg-[rgba(0,180,216,0.08)]"
          : "border-danger/40 bg-[rgba(239,68,68,0.08)]"
      }`}
    >
      <p
        className={`font-mono text-xs ${ok ? "text-accent-bright" : "text-danger"}`}
      >
        <span className="opacity-60">// </span>
        {state.message}
      </p>
    </div>
  );
}

export function ProfileDetailsForm({
  name,
  agency,
  email,
}: {
  name: string;
  agency: string;
  email: string;
}) {
  const [state, formAction] = useActionState(updateProfileAction, initial);

  return (
    <section className="bracket panel p-6 sm:p-8">
      <p className="eyebrow eyebrow-gold">// Account</p>
      <h2 className="display-sm mt-2">Profile details</h2>
      <p className="mt-2 text-sm text-muted">
        Your display name appears across the platform and on your certificates.
      </p>

      <Notice state={state} />

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <Field
          label="Display name"
          name="name"
          autoComplete="name"
          defaultValue={name}
        />
        <Field
          label="Agency"
          name="agency"
          autoComplete="organization"
          defaultValue={agency}
          placeholder="Your department or organization"
        />
        <div className="flex flex-col gap-2">
          <span className="eyebrow eyebrow-muted">Email</span>
          <p className="field flex items-center text-muted" aria-readonly>
            {email}
          </p>
          <p className="font-mono text-[10px] leading-relaxed text-muted">
            <span className="opacity-60">// </span>
            Email is your sign-in and can&apos;t be changed here — contact an
            admin if it needs updating.
          </p>
        </div>
        <SubmitButton label="Save changes" />
      </form>
    </section>
  );
}

export function ChangePasswordCard() {
  const [state, formAction] = useActionState(updatePasswordAction, initial);

  return (
    <section className="bracket panel p-6 sm:p-8">
      <p className="eyebrow eyebrow-gold">// Security</p>
      <h2 className="display-sm mt-2">Change password</h2>
      <p className="mt-2 text-sm text-muted">
        Choose a strong password you don&apos;t use anywhere else.
      </p>

      <Notice state={state} />

      <form
        action={formAction}
        className="mt-6 flex flex-col gap-4"
        // Reset the fields after a successful change.
        key={state.ok ? "done" : "editing"}
      >
        <Field
          label="Current password"
          name="current"
          type="password"
          autoComplete="current-password"
        />
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
          At least 8 characters.
        </p>
        <SubmitButton label="Update password" />
      </form>
    </section>
  );
}
