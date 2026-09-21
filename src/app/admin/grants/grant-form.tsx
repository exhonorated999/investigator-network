"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { previewGrant } from "./actions";
import { GRANT_CATEGORIES, GRANT_CATEGORY_LABEL } from "@/lib/grant-categories";
import type { GrantCategory } from "@/generated/prisma";

export interface GrantFormValues {
  id?: string;
  title: string;
  url: string;
  grantingAgency: string;
  qualifyingAgency: string;
  summary: string;
  dueDate: string; // YYYY-MM-DD
  categories: GrantCategory[];
  published: boolean;
}

const EMPTY: GrantFormValues = {
  title: "",
  url: "",
  grantingAgency: "",
  qualifyingAgency: "",
  summary: "",
  dueDate: "",
  categories: [],
  published: false,
};

/** ISO datetime -> YYYY-MM-DD for the date input. */
function toDateInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      {pending ? "Working…" : label}
    </button>
  );
}

/**
 * Admin grant composer/editor. Paste a grant URL → the title, summary and
 * granting agency fill from the page, plus a best-effort due date. Eligibility
 * and anything the scraper misses is filled in by hand, then published.
 */
export function GrantForm({
  action,
  initial,
  submitLabel,
  resetOnSave,
}: {
  action: (formData: FormData) => void | Promise<void>;
  initial?: Partial<GrantFormValues>;
  submitLabel: string;
  resetOnSave?: boolean;
}) {
  const [v, setV] = useState<GrantFormValues>({ ...EMPTY, ...initial });
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(
    null
  );

  const set = <K extends keyof GrantFormValues>(
    key: K,
    value: GrantFormValues[K]
  ) => setV((prev) => ({ ...prev, [key]: value }));

  function toggleCategory(cat: GrantCategory) {
    setV((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  }

  function grab() {
    if (!v.url.trim()) {
      setNote({ tone: "bad", text: "Paste a grant URL first." });
      return;
    }
    setNote(null);
    start(async () => {
      const res = await previewGrant(v.url);
      if (!res.ok) {
        setNote({ tone: "bad", text: res.error });
        return;
      }
      const p = res.preview;
      setV((prev) => ({
        ...prev,
        url: p.url || prev.url,
        title: prev.title.trim() || p.title,
        summary: prev.summary.trim() || p.summary,
        grantingAgency: prev.grantingAgency.trim() || p.grantingAgency,
        dueDate: prev.dueDate || (p.dueDate ? toDateInput(p.dueDate) : ""),
      }));
      const missing = [
        !p.title && "title",
        !p.summary && "summary",
        !p.dueDate && "due date",
      ].filter(Boolean);
      setNote({
        tone: "ok",
        text: missing.length
          ? `Pulled what it published — no ${missing.join(
              ", "
            )}. Add eligibility & anything missing by hand.`
          : "Pulled from grant page. Review eligibility, then publish.",
      });
    });
  }

  return (
    <form
      action={action}
      onSubmit={() => {
        if (resetOnSave) setTimeout(() => setV({ ...EMPTY }), 0);
      }}
      className="grid gap-3"
    >
      {v.id ? <input type="hidden" name="id" value={v.id} /> : null}

      {/* url + autofill */}
      <div className="grid gap-2">
        <label htmlFor="url" className="eyebrow eyebrow-gold">
          Paste a grant link
        </label>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            id="url"
            name="url"
            type="url"
            inputMode="url"
            required
            placeholder="https://bja.ojp.gov/funding/opportunities/…"
            value={v.url}
            onChange={(e) => set("url", e.target.value)}
            className="field"
          />
          <button
            type="button"
            onClick={grab}
            disabled={pending}
            className="btn btn-ghost"
          >
            {pending ? "Fetching…" : "Fetch details"}
          </button>
        </div>
        {note ? (
          <p
            className={`font-mono text-[11px] ${
              note.tone === "ok" ? "text-accent-bright" : "text-danger"
            }`}
          >
            <span className="opacity-60">// </span>
            {note.text}
          </p>
        ) : (
          <p className="font-mono text-[11px] text-muted opacity-70">
            <span className="opacity-60">// </span>
            Paste the grant page URL and the title, summary, agency and due date
            fill themselves. Eligibility usually lives in the PDF — add it by hand.
          </p>
        )}
      </div>

      {/* title */}
      <div className="mt-1 grid gap-2">
        <label htmlFor="title" className="eyebrow eyebrow-muted">
          Grant title
        </label>
        <input
          id="title"
          name="title"
          required
          value={v.title}
          onChange={(e) => set("title", e.target.value)}
          className="field"
        />
      </div>

      {/* summary */}
      <div className="grid gap-2">
        <label htmlFor="summary" className="eyebrow eyebrow-muted">
          Summary
        </label>
        <textarea
          id="summary"
          name="summary"
          rows={4}
          value={v.summary}
          onChange={(e) => set("summary", e.target.value)}
          className="field resize-y text-[14px]"
        />
      </div>

      {/* agencies + due date */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor="grantingAgency" className="eyebrow eyebrow-muted">
            Granting agency
          </label>
          <input
            id="grantingAgency"
            name="grantingAgency"
            placeholder="Bureau of Justice Assistance"
            value={v.grantingAgency}
            onChange={(e) => set("grantingAgency", e.target.value)}
            className="field"
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="qualifyingAgency" className="eyebrow eyebrow-muted">
            Qualifying / eligible agencies
          </label>
          <input
            id="qualifyingAgency"
            name="qualifyingAgency"
            placeholder="State & local law enforcement"
            value={v.qualifyingAgency}
            onChange={(e) => set("qualifyingAgency", e.target.value)}
            className="field"
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="dueDate" className="eyebrow eyebrow-muted">
            Application due date
          </label>
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            value={v.dueDate}
            onChange={(e) => set("dueDate", e.target.value)}
            className="field"
          />
        </div>
      </div>

      {/* categories */}
      <div className="grid gap-2">
        <span className="eyebrow eyebrow-muted">
          Relevance — what could this fund?
        </span>
        <div className="flex flex-wrap gap-2">
          {GRANT_CATEGORIES.map((cat) => {
            const on = v.categories.includes(cat);
            return (
              <label
                key={cat}
                className={`cursor-pointer select-none rounded-md border px-3 py-1.5 text-[13px] transition ${
                  on
                    ? "border-accent bg-[rgba(0,180,216,0.12)] text-foreground"
                    : "border-border text-muted hover:border-border-strong"
                }`}
              >
                <input
                  type="checkbox"
                  name="categories"
                  value={cat}
                  checked={on}
                  onChange={() => toggleCategory(cat)}
                  className="sr-only"
                />
                {GRANT_CATEGORY_LABEL[cat]}
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <label className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-wider text-muted">
          <input
            type="checkbox"
            name="published"
            checked={v.published}
            onChange={(e) => set("published", e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Published (visible on LE dashboards)
        </label>
        <Save label={submitLabel} />
      </div>
    </form>
  );
}
