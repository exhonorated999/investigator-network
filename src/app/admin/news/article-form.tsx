"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { previewLink } from "./actions";

export interface ArticleFormValues {
  id?: string;
  title: string;
  sourceUrl: string;
  sourceName: string;
  category: string;
  audience: "ALL" | "LE" | "CIVILIAN";
  summary: string;
  body: string;
  imageUrl: string;
  published: boolean;
  publishedAt: string;
}

const EMPTY: ArticleFormValues = {
  title: "",
  sourceUrl: "",
  sourceName: "",
  category: "",
  audience: "ALL",
  summary: "",
  body: "",
  imageUrl: "",
  published: true,
  publishedAt: "",
};

/** `YYYY-MM-DDTHH:mm` in local time, for the datetime-local input. */
function toLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
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
 * Newsroom article form, shared by the composer and the editor.
 *
 * Paste a URL and the fields fill themselves from the page's OpenGraph tags —
 * "Pull text" additionally scrapes the paragraphs so the article can be read
 * in-app. Everything stays editable for original announcements.
 */
export function ArticleForm({
  action,
  categories,
  suggestions = [],
  initial,
  submitLabel,
  compact,
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: string[];
  suggestions?: string[];
  initial?: Partial<ArticleFormValues>;
  submitLabel: string;
  /** Composer mode: reset the form after a successful file. */
  compact?: boolean;
}) {
  const [v, setV] = useState<ArticleFormValues>({ ...EMPTY, ...initial });
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(
    null
  );

  const set = <K extends keyof ArticleFormValues>(
    key: K,
    value: ArticleFormValues[K]
  ) => setV((prev) => ({ ...prev, [key]: value }));

  function grab(withBody: boolean) {
    if (!v.sourceUrl.trim()) {
      setNote({ tone: "bad", text: "Paste a URL first." });
      return;
    }
    setNote(null);
    start(async () => {
      const res = await previewLink(v.sourceUrl, withBody);
      if (!res.ok) {
        setNote({ tone: "bad", text: res.error });
        return;
      }
      const p = res.preview;
      setV((prev) => ({
        ...prev,
        // Never clobber something already typed.
        sourceUrl: p.url || prev.sourceUrl,
        title: prev.title.trim() || p.title,
        summary: prev.summary.trim() || p.summary,
        sourceName: prev.sourceName.trim() || p.sourceName,
        imageUrl: prev.imageUrl.trim() || p.imageUrl,
        publishedAt: prev.publishedAt || (p.publishedAt ? toLocal(p.publishedAt) : ""),
        body: withBody && p.body ? p.body : prev.body,
      }));

      const missing = [
        !p.title && "headline",
        !p.summary && "summary",
        !p.imageUrl && "image",
        withBody && !p.body && "article text",
      ].filter(Boolean);

      setNote({
        tone: "ok",
        text: missing.length
          ? `Pulled what it published — no ${missing.join(", ")}. Add by hand.`
          : "Pulled from source.",
      });
    });
  }

  const catList = [
    ...categories,
    ...suggestions.filter((s) => !categories.includes(s)),
  ];

  return (
    <form action={action} className="grid gap-3">
      {v.id ? <input type="hidden" name="id" value={v.id} /> : null}

      {/* -------------------------------------------------- url + autofill */}
      <div className="grid gap-2">
        <label htmlFor="sourceUrl" className="eyebrow eyebrow-gold">
          Paste a link
        </label>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input
            id="sourceUrl"
            name="sourceUrl"
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={v.sourceUrl}
            onChange={(e) => set("sourceUrl", e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text").trim();
              if (!pasted || v.title.trim()) return;
              // Autofill straight off the paste — the whole point of the field.
              e.preventDefault();
              setV((prev) => ({ ...prev, sourceUrl: pasted }));
              setNote(null);
              start(async () => {
                const res = await previewLink(pasted, false);
                if (!res.ok) {
                  setNote({ tone: "bad", text: res.error });
                  return;
                }
                const p = res.preview;
                setV((prev) => ({
                  ...prev,
                  sourceUrl: p.url || pasted,
                  title: prev.title.trim() || p.title,
                  summary: prev.summary.trim() || p.summary,
                  sourceName: prev.sourceName.trim() || p.sourceName,
                  imageUrl: prev.imageUrl.trim() || p.imageUrl,
                  publishedAt:
                    prev.publishedAt || (p.publishedAt ? toLocal(p.publishedAt) : ""),
                }));
                setNote({ tone: "ok", text: "Pulled from source." });
              });
            }}
            className="field"
          />
          <button
            type="button"
            onClick={() => grab(false)}
            disabled={pending}
            className="btn btn-ghost"
          >
            {pending ? "Fetching…" : "Fetch details"}
          </button>
          <button
            type="button"
            onClick={() => grab(true)}
            disabled={pending}
            className="btn btn-ghost"
            title="Also scrape the article paragraphs so it can be read in-app"
          >
            + Pull text
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
            Paste a link and the headline, summary, image and source fill
            themselves. Leave it blank to write your own announcement.
          </p>
        )}
      </div>

      {/* ------------------------------------------------------------ core */}
      <div className="mt-1 grid gap-2">
        <label htmlFor="title" className="eyebrow eyebrow-muted">
          Headline
        </label>
        <input
          id="title"
          name="title"
          required
          placeholder="Headline"
          value={v.title}
          onChange={(e) => set("title", e.target.value)}
          className="field"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
        <div className="grid gap-2">
          <label htmlFor="sourceName" className="eyebrow eyebrow-muted">
            Source name
          </label>
          <input
            id="sourceName"
            name="sourceName"
            placeholder="DOJ, Wired, Intellect LE…"
            value={v.sourceName}
            onChange={(e) => set("sourceName", e.target.value)}
            className="field"
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="category" className="eyebrow eyebrow-muted">
            Topic
          </label>
          <input
            id="category"
            name="category"
            list="news-cats"
            placeholder="ICAC, Narcotics…"
            value={v.category}
            onChange={(e) => set("category", e.target.value)}
            className="field"
          />
          <datalist id="news-cats">
            {catList.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="grid gap-2">
        <label htmlFor="audience" className="eyebrow eyebrow-muted">
          Audience
        </label>
        <select
          id="audience"
          name="audience"
          value={v.audience}
          onChange={(e) =>
            set("audience", e.target.value as ArticleFormValues["audience"])
          }
          className="field"
        >
          <option value="ALL">Both sides (LE + Civilian)</option>
          <option value="LE">Law Enforcement only</option>
          <option value="CIVILIAN">Civilian (Private Investigator) only</option>
        </select>
        <p className="font-mono text-[11px] text-muted">
          <span className="opacity-60">// </span>
          Civilian-only articles form the Private Investigator News feed.
        </p>
      </div>

      <div className="grid gap-2">
        <label htmlFor="summary" className="eyebrow eyebrow-muted">
          Summary
        </label>
        <textarea
          id="summary"
          name="summary"
          rows={2}
          placeholder="Why it matters — shown on the dashboard card."
          value={v.summary}
          onChange={(e) => set("summary", e.target.value)}
          className="field resize-y"
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="body" className="eyebrow eyebrow-muted">
          Article text{" "}
          <span className="text-muted opacity-70">
            — leave empty to link straight out
          </span>
        </label>
        <textarea
          id="body"
          name="body"
          rows={compact ? 6 : 14}
          placeholder="Blank lines separate paragraphs. Use + Pull text to scrape it from the source."
          value={v.body}
          onChange={(e) => set("body", e.target.value)}
          className="field resize-y font-mono text-[13px]"
        />
      </div>

      {/* --------------------------------------------------------- artwork */}
      <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
        <div className="grid gap-2">
          <label htmlFor="imageUrl" className="eyebrow eyebrow-muted">
            Image URL
          </label>
          <input
            id="imageUrl"
            name="imageUrl"
            type="url"
            placeholder="https://…"
            value={v.imageUrl}
            onChange={(e) => set("imageUrl", e.target.value)}
            className="field"
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="publishedAt" className="eyebrow eyebrow-muted">
            Published at
          </label>
          <input
            id="publishedAt"
            name="publishedAt"
            type="datetime-local"
            value={v.publishedAt}
            onChange={(e) => set("publishedAt", e.target.value)}
            className="field"
          />
        </div>
      </div>

      {v.imageUrl ? (
        <div className="bracket max-w-md overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={v.imageUrl}
            alt=""
            className="aspect-[16/9] w-full object-cover opacity-85"
          />
        </div>
      ) : null}

      <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <label className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-wider text-muted">
          <input
            type="checkbox"
            name="published"
            checked={v.published}
            onChange={(e) => set("published", e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Published
        </label>
        <Save label={submitLabel} />
      </div>
    </form>
  );
}
