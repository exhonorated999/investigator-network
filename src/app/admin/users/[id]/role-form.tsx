"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { setUserRole, type RoleState } from "../actions";

const initial: RoleState = { ok: false };

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
      {pending ? "Saving…" : "Update role"}
    </button>
  );
}

/**
 * Change a user's role / side. `current` is one of LE | CIVILIAN | ADMIN.
 * The Admin option is only offered to the super admin (`canGrantAdmin`).
 */
export function RoleForm({
  userId,
  current,
  canGrantAdmin,
}: {
  userId: string;
  current: "LE" | "CIVILIAN" | "ADMIN";
  canGrantAdmin: boolean;
}) {
  const [state, action] = useActionState(setUserRole, initial);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="grid gap-1.5">
        <span className="eyebrow eyebrow-muted">Role &amp; side</span>
        <select name="role" defaultValue={current} className="field w-64">
          <option value="LE">Law Enforcement</option>
          <option value="CIVILIAN">Civilian</option>
          <option value="ADMIN" disabled={!canGrantAdmin && current !== "ADMIN"}>
            Admin{!canGrantAdmin ? " (super admin only)" : ""}
          </option>
        </select>
      </label>
      <Save />
      {state.message ? (
        <p
          className={`w-full font-mono text-[11px] ${
            state.ok ? "text-success" : "text-danger"
          }`}
        >
          <span className="opacity-60">// </span>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
