"use client";

import { useState } from "react";
import type { KnowledgeCheckBlock } from "@/lib/blocks";

/**
 * Knowledge check client component.
 *
 * Ungraded self-check — nothing is sent to the server. The user picks a
 * choice, clicks "Check answer", and correct/incorrect styling is revealed
 * along with the explanation. Retry is always available.
 *
 * The explanation is pre-rendered to HTML on the server and passed as a prop,
 * so marked never enters the client bundle.
 */
export function KnowledgeCheckBlockView({
  block,
  explanationHtml,
}: {
  block: KnowledgeCheckBlock;
  /** Pre-rendered HTML string for the explanation. */
  explanationHtml: string;
}) {
  const question = block.question.trim();
  const choices = block.choices.filter((c) => c.text.trim());

  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  if (!question || !choices.length) return null;

  const selectedChoice = choices.find((c) => c.id === selected);
  const isCorrect = checked && selectedChoice?.correct === true;

  const reset = () => {
    setSelected(null);
    setChecked(false);
  };

  return (
    <div className="panel rule-top p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-mono text-sm text-accent" aria-hidden>
          ?
        </span>
        <span className="eyebrow eyebrow-muted">KNOWLEDGE CHECK · UNGRADED</span>
      </div>
      <p className="mb-4 font-display text-sm font-semibold uppercase tracking-wide text-foreground">
        {question}
      </p>
      <div className="grid gap-2">
        {choices.map((choice) => {
          const isSelected = selected === choice.id;
          let stateClass = "border-border bg-surface-2 hover:border-accent/30";
          if (checked) {
            if (choice.correct) {
              stateClass = "border-success bg-[rgba(74,222,128,0.06)]";
            } else if (isSelected) {
              stateClass = "border-danger bg-[rgba(239,68,68,0.06)]";
            } else {
              stateClass = "border-border bg-surface-2 opacity-60";
            }
          } else if (isSelected) {
            stateClass = "border-accent bg-[rgba(0,180,216,0.06)]";
          }
          return (
            <label
              key={choice.id}
              className={`flex cursor-pointer items-center gap-3 border p-3 transition ${stateClass}`}
            >
              <input
                type="radio"
                name={`kc-${block.id}`}
                value={choice.id}
                checked={isSelected}
                onChange={() => !checked && setSelected(choice.id)}
                disabled={checked}
                className="sr-only"
              />
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] transition ${
                  isSelected
                    ? checked
                      ? choice.correct
                        ? "border-success text-success"
                        : "border-danger text-danger"
                      : "border-accent text-accent"
                    : "border-border-strong text-transparent"
                }`}
                aria-hidden
              >
                ●
              </span>
              <span className="text-sm text-foreground">{choice.text}</span>
              {checked && choice.correct ? (
                <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-success">
                  Correct
                </span>
              ) : null}
              {checked && isSelected && !choice.correct ? (
                <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-danger">
                  Incorrect
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3">
        {!checked ? (
          <button
            type="button"
            onClick={() => setChecked(true)}
            disabled={!selected}
            className="btn btn-primary btn-sm"
          >
            Check answer
          </button>
        ) : (
          <button
            type="button"
            onClick={reset}
            className="btn btn-ghost btn-sm"
          >
            ↻ Try again
          </button>
        )}
        {checked ? (
          <span
            className={`font-mono text-xs uppercase tracking-[0.14em] ${
              isCorrect ? "text-success" : "text-danger"
            }`}
          >
            {isCorrect ? "✓ Correct" : "✖ Not quite"}
          </span>
        ) : null}
      </div>
      {checked && explanationHtml ? (
        <div
          className="mt-4 border-t border-border pt-4 text-sm text-foreground [&_a]:text-accent [&_a]:underline [&_p]:my-2 [&_p]:max-w-[68ch] [&_strong]:text-foreground [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_code]:text-accent-bright"
          dangerouslySetInnerHTML={{ __html: explanationHtml }}
        />
      ) : null}
    </div>
  );
}
