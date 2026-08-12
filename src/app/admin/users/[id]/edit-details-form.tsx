"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateUserDetails, type UpdateDetailsState } from "../actions";

const initial: UpdateDetailsState = { ok: false };

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
      {pending ? "Saving…" : "Save details"}
    </button>
  );
}

/**
 * Admin edit of a user's core profile fields — for correcting typos in the
 * name, email, agency, or state entered at registration / account creation.
 */
export function EditDetailsForm({
  userId,
  name,
  email,
  agency,
  state,
}: {
  userId: string;
  name: string;
  email: string;
  agency: string;
  state: string;
}) {
  const [result, action] = useActionState(updateUserDetails, initial);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="grid gap-1.5">
        <span className="eyebrow eyebrow-muted">Full name</span>
        <input name="name" required defaultValue={name} className="field" />
      </label>
      <label className="grid gap-1.5">
        <span className="eyebrow eyebrow-muted">Email</span>
        <input
          type="email"
          name="email"
          required
          defaultValue={email}
          className="field"
        />
      </label>
      <label className="grid gap-1.5">
        <span className="eyebrow eyebrow-muted">Agency</span>
        <input name="agency" defaultValue={agency} className="field" />
      </label>
      <label className="grid gap-1.5">
        <span className="eyebrow eyebrow-muted">State / region</span>
        <input name="state" defaultValue={state} className="field" />
      </label>
      <div className="sm:col-span-2 flex items-center gap-3">
        <Save />
        {result.message ? (
          <p
            className={`font-mono text-[11px] ${
              result.ok ? "text-success" : "text-danger"
            }`}
          >
            <span className="opacity-60">// </span>
            {result.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
