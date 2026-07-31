"use client";

import { useState } from "react";
import type { ScenarioBlock } from "@/lib/blocks";
import { useInteractions } from "@/components/blocks/interaction-store";
import { PROSE_INLINE } from "@/components/blocks/prose";

/**
 * Scenario client component — the flagship interactive block.
 *
 * A decision point: the learner picks one course of action and sees the
 * consequence. When `requireCorrect` is true, the chosen option is marked
 * sound/unsound and "Reconsider" resets. When false, no right/wrong is shown —
 * the learner can explore every branch via "Explore another option".
 *
 * The prompt and each option's outcome are pre-rendered to HTML on the server
 * and passed as props, so marked never enters the client bundle.
 */
export function ScenarioBlockView({
  block,
  promptHtml,
  outcomeHtml,
}: {
  block: ScenarioBlock;
  /** Pre-rendered HTML string for the prompt. */
  promptHtml: string;
  /** Pre-rendered HTML strings for each option's outcome, keyed by option id. */
  outcomeHtml: Record<string, string>;
}) {
  const options = block.options.filter((o) => o.text.trim());
  const title = block.title.trim();
  const { answers, save } = useInteractions();

  // Seed from the store.
  const savedOptionId = answers[block.id]?.payload.optionId ?? null;
  const [chosenId, setChosenId] = useState<string | null>(savedOptionId);

  if (!promptHtml || !options.length) return null;

  const chosenOption = options.find((o) => o.id === chosenId) ?? null;

  // Required edge treatment.
  const satisfied = block.required
    ? chosenOption
      ? block.requireCorrect
        ? chosenOption.correct
        : true
      : false
    : false;

  const requiredEdge = block.required
    ? satisfied
      ? "border-l-2 border-l-success"
      : "border-l-2 border-l-gold"
    : "";

  const choose = (id: string) => {
    setChosenId(id);
    save(block.id, { optionId: id });
  };

  const reconsider = () => {
    setChosenId(null);
  };

  return (
    <div className={`panel rule-top p-5 ${requiredEdge}`}>
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <span className="font-mono text-sm text-accent" aria-hidden>
          ⑂
        </span>
        <span className="eyebrow eyebrow-muted">
          SCENARIO
          {block.required ? " · REQUIRED" : ""}
        </span>
      </div>
      {title ? (
        <h3 className="mb-3 font-display text-lg font-bold uppercase tracking-wide text-accent-bright">
          {title}
        </h3>
      ) : null}

      {/* Prompt */}
      <div
        className={`mb-5 text-sm ${PROSE_INLINE}`}
        dangerouslySetInnerHTML={{ __html: promptHtml }}
      />

      {/* Options */}
      <div
        className="grid gap-3"
        role="group"
        aria-label="Decision options"
      >
        {options.map((option, i) => {
          const isChosen = chosenId === option.id;
          const letter = String.fromCharCode(65 + i); // A, B, C…

          let cardClass =
            "border-border bg-surface-2 hover:border-accent/40 hover:bg-[rgba(0,180,216,0.03)]";
          if (chosenId) {
            if (isChosen) {
              if (block.requireCorrect) {
                cardClass = option.correct
                  ? "border-success bg-[rgba(74,222,128,0.06)]"
                  : "border-danger bg-[rgba(239,68,68,0.06)]";
              } else {
                cardClass =
                  "border-accent bg-[rgba(0,180,216,0.06)]";
              }
            } else {
              cardClass = "border-border bg-surface-2 opacity-50";
            }
          }

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => !chosenId && choose(option.id)}
              disabled={!!chosenId}
              aria-pressed={isChosen}
              className={`flex items-start gap-4 border p-4 text-left transition ${cardClass} ${
                !chosenId
                  ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  : "cursor-default"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center border font-mono text-xs font-bold transition ${
                  isChosen
                    ? block.requireCorrect
                      ? option.correct
                        ? "border-success text-success"
                        : "border-danger text-danger"
                      : "border-accent text-accent"
                    : "border-border-strong text-muted"
                }`}
                aria-hidden
              >
                {letter}
              </span>
              <span className="text-sm text-foreground">{option.text}</span>
              {chosenId && isChosen && block.requireCorrect ? (
                <span
                  className={`ml-auto shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] ${
                    option.correct ? "text-success" : "text-danger"
                  }`}
                >
                  {option.correct ? "✓ Sound" : "✖ Unsound"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Consequence panel */}
      {chosenOption ? (
        <div
          className="mt-5 animate-[reveal-up_0.3s_ease-in-out]"
          aria-live="polite"
        >
          <div className="mb-3 flex items-center gap-2">
            <span
              className={`font-mono text-sm ${
                block.requireCorrect
                  ? chosenOption.correct
                    ? "text-success"
                    : "text-danger"
                  : "text-accent"
              }`}
              aria-hidden
            >
              ▸
            </span>
            <span
              className={`eyebrow ${
                block.requireCorrect
                  ? chosenOption.correct
                    ? "text-success"
                    : "text-danger"
                  : ""
              }`}
            >
              CONSEQUENCE
            </span>
          </div>
          <div
            className={`border-l-2 pl-4 text-sm ${PROSE_INLINE} ${
              block.requireCorrect
                ? chosenOption.correct
                  ? "border-l-success"
                  : "border-l-danger"
                : "border-l-accent"
            }`}
            dangerouslySetInnerHTML={{
              __html: outcomeHtml[chosenOption.id] ?? "",
            }}
          />
          <div className="mt-4">
            {block.requireCorrect ? (
              <button
                type="button"
                onClick={reconsider}
                className="btn btn-ghost btn-sm"
              >
                ↻ Reconsider
              </button>
            ) : (
              <button
                type="button"
                onClick={reconsider}
                className="btn btn-ghost btn-sm"
              >
                ⇄ Explore another option
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
