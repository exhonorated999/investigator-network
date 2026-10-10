"use client";

import { useActionState, useState } from "react";
import {
  STAR_LABELS,
  type EvaluationConfig,
  type EvalQuestion,
} from "@/lib/evaluation-config";
import { submitEvaluation, type EvalFormState } from "./actions";

const initial: EvalFormState = { error: null };

export function EvaluationForm({
  slug,
  config,
  preview = false,
}: {
  slug: string;
  config: EvaluationConfig;
  preview?: boolean;
}) {
  const [state, action, pending] = useActionState(submitEvaluation, initial);
  const [testimonialOk, setTestimonialOk] = useState<"" | "yes" | "no">("");

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="slug" value={slug} />

      {config.questions.map((q, i) => (
        <fieldset key={q.id} className="panel p-5">
          <legend className="sr-only">{q.label}</legend>
          <p className="text-[15px] text-foreground">
            <span className="mr-2 font-mono text-xs text-muted">
              {(i + 1).toString().padStart(2, "0")}
            </span>
            {q.label}
            {q.kind !== "text" || q.required ? (
              <span className="ml-1 text-danger">*</span>
            ) : (
              <span className="ml-2 text-xs text-muted">(optional)</span>
            )}
          </p>
          <div className="mt-3">
            <QuestionInput q={q} />
          </div>
        </fieldset>
      ))}

      {config.testimonial ? (
        <fieldset className="panel p-5">
          <legend className="sr-only">{config.testimonial.label}</legend>
          <p className="text-[15px] text-foreground">
            {config.testimonial.label}
            <span className="ml-1 text-danger">*</span>
          </p>
          <div className="mt-3">
            <YesNo
              name="testimonialOk"
              value={testimonialOk}
              onChange={setTestimonialOk}
            />
          </div>
          {testimonialOk === "yes" ? (
            <ControlledText
              name="testimonial"
              required
              rows={5}
              placeholder="Share a few sentences about your experience…"
              className="mt-4"
            />
          ) : null}
        </fieldset>
      ) : null}

      {state.error ? (
        <p className="border border-danger/40 bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div>
        <button className="btn btn-primary" disabled={pending || preview}>
          {preview
            ? "Submit disabled (admin preview)"
            : pending
              ? "Submitting…"
              : "Submit evaluation & get certificate"}
        </button>
      </div>
    </form>
  );
}

function QuestionInput({ q }: { q: EvalQuestion }) {
  if (q.kind === "stars") return <Stars name={q.id} />;
  if (q.kind === "yesno") return <YesNoUncontrolled name={q.id} />;
  return <ControlledText name={q.id} required={q.required} rows={4} />;
}

function ControlledText({
  name,
  required,
  rows,
  placeholder,
  className = "",
}: {
  name: string;
  required?: boolean;
  rows: number;
  placeholder?: string;
  className?: string;
}) {
  const [v, setV] = useState("");
  return (
    <textarea
      name={name}
      rows={rows}
      maxLength={4000}
      required={required}
      placeholder={placeholder}
      value={v}
      onChange={(e) => setV(e.target.value)}
      className={`field w-full ${className}`}
    />
  );
}

function Stars({ name }: { name: string }) {
  const [value, setValue] = useState(0);
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input type="hidden" name={name} value={value || ""} />
      <div
        className="flex gap-1"
        role="radiogroup"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""} — ${STAR_LABELS[n - 1]}`}
            onClick={() => setValue(n)}
            onMouseEnter={() => setHover(n)}
            className={`text-3xl leading-none transition ${
              n <= shown ? "text-gold" : "text-muted/30"
            } hover:scale-110`}
          >
            ★
          </button>
        ))}
      </div>
      <span className="font-mono text-xs text-muted">
        {shown ? `${shown}/5 · ${STAR_LABELS[shown - 1]}` : "Select a rating"}
      </span>
    </div>
  );
}

function YesNoUncontrolled({ name }: { name: string }) {
  const [v, setV] = useState<"" | "yes" | "no">("");
  return <YesNo name={name} value={v} onChange={setV} />;
}

function YesNo({
  name,
  value,
  onChange,
}: {
  name: string;
  value: "" | "yes" | "no";
  onChange: (v: "yes" | "no") => void;
}) {
  return (
    <div className="flex gap-3">
      {(["yes", "no"] as const).map((opt) => (
        <label
          key={opt}
          className={`btn btn-sm cursor-pointer ${
            value === opt ? "btn-primary" : "btn-ghost"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="sr-only"
          />
          {opt === "yes" ? "Yes" : "No"}
        </label>
      ))}
    </div>
  );
}
