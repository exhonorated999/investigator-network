"use client";

/**
 * Completion control for a unit.
 *
 * For most unit types this is the same single button it always was. For a
 * NOTES unit with required interactive blocks it also watches the interaction
 * store, so ticking the last required checklist item enables the button
 * immediately — no page reload, no polling.
 *
 * The disabled state is a courtesy only; `setUnitComplete` re-checks the gate
 * server-side before writing.
 */

import { useFormStatus } from "react-dom";
import { useInteractions } from "./blocks/interaction-store";

function Submit({
  isDone,
  blocked,
}: {
  isDone: boolean;
  blocked: boolean;
}) {
  const { pending } = useFormStatus();
  const disabled = blocked || pending;

  return (
    <button
      className={isDone ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"}
      disabled={disabled}
      style={
        isDone
          ? { color: "var(--success)", borderColor: "rgba(74,222,128,0.4)" }
          : disabled
            ? { opacity: 0.5, cursor: "not-allowed" }
            : undefined
      }
    >
      {pending
        ? "Saving…"
        : isDone
          ? "✓ Completed — mark incomplete"
          : "Mark as complete"}
    </button>
  );
}

export function CompletionGate({
  unitId,
  slug,
  isDone,
  action,
}: {
  unitId: string;
  slug: string;
  isDone: boolean;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const { requiredTotal, outstanding, passed, preview } = useInteractions();

  // Un-completing is never gated — a learner who ticked the box by mistake
  // must always be able to take it back.
  const blocked = !isDone && !passed;
  const remaining = outstanding.length;

  return (
    <div className="mt-8">
      {requiredTotal > 0 ? (
        <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em]">
          <span className={passed ? "text-success" : "text-gold"}>
            {passed ? "✓" : "○"}
          </span>
          <span className={passed ? "text-success" : "text-muted"}>
            {passed
              ? `All ${requiredTotal} required ${requiredTotal === 1 ? "activity" : "activities"} complete`
              : `${requiredTotal - remaining} of ${requiredTotal} required ${
                  requiredTotal === 1 ? "activity" : "activities"
                } complete`}
          </span>
        </div>
      ) : null}

      <form action={action}>
        <input type="hidden" name="unitId" value={unitId} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="complete" value={isDone ? "false" : "true"} />
        <Submit isDone={isDone} blocked={blocked} />
      </form>

      {blocked ? (
        <p className="mt-2 text-xs text-muted">
          Finish the required activities above to complete this unit.
        </p>
      ) : null}

      {preview ? (
        <p className="mt-2 text-xs text-muted">
          Admin preview — your answers are evaluated but not recorded.
        </p>
      ) : null}
    </div>
  );
}
