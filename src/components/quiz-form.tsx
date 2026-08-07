"use client";

/**
 * The interactive test form.
 *
 * Multiple-choice selections are auto-saved to a per-user draft as the learner
 * works, so they can leave a long test (a case pulls them away) and come back
 * later to pick up exactly where they left off. On return the server hydrates
 * this component with the saved draft and every choice is re-checked.
 *
 * Only multiple-choice answers are drafted — a browser will not let JavaScript
 * re-populate a file input, so document-upload questions must be re-attached on
 * the visit where the learner actually submits.
 *
 * Submitting runs the normal `submitAttempt` server action, which grades the
 * attempt and clears the draft.
 */

import { useCallback, useRef, useState } from "react";
import { submitAttempt } from "@/app/courses/actions";

export interface QuizFormChoice {
  id: string;
  text: string;
}
export interface QuizFormQuestion {
  id: string;
  type: "MULTIPLE_CHOICE" | "DOCUMENT_UPLOAD";
  prompt: string;
  points: number;
  multiSelect: boolean;
  choices: QuizFormChoice[];
}

type Draft = Record<string, string | string[]>;

export function QuizForm({
  unitId,
  slug,
  questions,
  initialDraft,
  submitLabel,
}: {
  unitId: string;
  slug: string;
  questions: QuizFormQuestion[];
  initialDraft: Draft;
  submitLabel: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">(
    Object.keys(initialDraft).length > 0 ? "saved" : "idle"
  );

  const isChecked = (qid: string, choiceId: string): boolean => {
    const v = initialDraft[qid];
    if (Array.isArray(v)) return v.includes(choiceId);
    return v === choiceId;
  };

  // Read the current multiple-choice selections straight off the form and
  // persist them. Debounced so a burst of clicks collapses into one write.
  const scheduleSave = useCallback(() => {
    setSaved("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const form = formRef.current;
      if (!form) return;
      const fd = new FormData(form);
      const answers: Draft = {};
      for (const q of questions) {
        if (q.type !== "MULTIPLE_CHOICE") continue;
        const values = fd.getAll(`q_${q.id}`).map(String).filter(Boolean);
        if (values.length === 0) continue;
        answers[q.id] = q.multiSelect ? values : values[0]!;
      }
      void fetch("/api/quiz-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, answers }),
      })
        .then((r) => setSaved(r.ok ? "saved" : "idle"))
        .catch(() => setSaved("idle"));
    }, 600);
  }, [questions, unitId]);

  return (
    <form
      ref={formRef}
      action={submitAttempt}
      encType="multipart/form-data"
      onChange={scheduleSave}
      className="space-y-6"
    >
      <input type="hidden" name="unitId" value={unitId} />
      <input type="hidden" name="slug" value={slug} />

      <div
        className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted"
        aria-live="polite"
      >
        {saved === "saving" ? (
          <>
            <span className="text-gold">○</span> Saving your progress…
          </>
        ) : saved === "saved" ? (
          <>
            <span className="text-success">✓</span> Progress saved — you can
            leave and resume later
          </>
        ) : (
          <>
            <span className="text-muted/50">○</span> Your answers save
            automatically as you go
          </>
        )}
      </div>

      {questions.map((q, i) => (
        <fieldset key={q.id} className="panel rule-top p-5">
          <legend className="flex items-center gap-3 px-1">
            <span className="font-mono text-sm font-bold text-accent-bright">
              Q{(i + 1).toString().padStart(2, "0")}
            </span>
            <span className="text-[15px] font-semibold text-foreground">
              {q.prompt}
            </span>
            <span className="tag-chip">
              {q.points} pt{q.points === 1 ? "" : "s"}
            </span>
          </legend>

          {q.type === "MULTIPLE_CHOICE" ? (
            <div className="mt-4 space-y-2.5">
              {q.multiSelect ? (
                <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-accent-bright">
                  Select all that apply
                </p>
              ) : null}
              {q.choices.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-3 border border-border bg-well px-4 py-3 text-[15px] text-foreground transition hover:border-accent/50 hover:bg-[rgba(0,180,216,0.06)] has-[:checked]:border-accent has-[:checked]:bg-[rgba(0,180,216,0.1)] has-[:checked]:shadow-[0_0_16px_rgba(0,180,216,0.2)]"
                >
                  <input
                    type={q.multiSelect ? "checkbox" : "radio"}
                    name={`q_${q.id}`}
                    value={c.id}
                    required={!q.multiSelect}
                    defaultChecked={isChecked(q.id, c.id)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  {c.text || <span className="text-muted">(empty choice)</span>}
                </label>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <label className="group flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-accent/30 bg-[rgba(0,180,216,0.04)] px-6 py-8 text-center transition hover:border-accent/60 hover:bg-[rgba(0,180,216,0.08)]">
                <span className="text-2xl text-accent">📎</span>
                <span className="eyebrow">Drop file or click to browse</span>
                <input
                  type="file"
                  name={`file_${q.id}`}
                  required
                  className="text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:text-foreground"
                />
              </label>
              <p className="mt-2 font-mono text-xs text-muted">
                Upload your document. This answer is graded by an instructor.
                (Uploads aren&apos;t saved in progress drafts — re-attach on the
                visit you submit.)
              </p>
            </div>
          )}
        </fieldset>
      ))}

      <button className="btn btn-primary">{submitLabel}</button>
    </form>
  );
}
