"use client";

import { useActionState, useState } from "react";
import type { Block } from "@/lib/blocks";
import { setNotesJson, type JsonResult } from "@/app/admin/courses/notes-actions";

/**
 * JSON source view for a notes document.
 *
 * This is the escape hatch that keeps the format from being gated by the
 * editor UI: the whole document can be read out, edited elsewhere (or written
 * from scratch), and pasted back in one operation. Anything the block format
 * supports is authorable here even if no visual control exists for it yet.
 *
 * Import replaces the entire document, so the current source is shown
 * alongside — copy first, then overwrite.
 */
export function NotesJsonPanel({
  unitId,
  courseId,
  blocks,
}: {
  unitId: string;
  courseId: string;
  blocks: Block[];
}) {
  const current = JSON.stringify({ version: 1, blocks }, null, 2);
  const [state, formAction, pending] = useActionState<JsonResult | null, FormData>(
    setNotesJson,
    null
  );
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(current);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked by permissions; the textarea below is still
      // selectable, so this is a convenience rather than the only route.
    }
  }

  return (
    <details className="mt-8 border border-border bg-well-soft">
      <summary className="cursor-pointer list-none px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-accent transition hover:text-accent-bright">
        ⟨/⟩ JSON source
      </summary>

      <div className="border-t border-border p-4">
        <p className="max-w-[68ch] text-sm text-muted">
          The document below is the complete source for this page. Editing it
          here is equivalent to using the builder above — useful for bulk
          changes, moving a page between units, or handing the whole structure
          to someone (or something) that can write it faster than you can click
          it.
        </p>

        <div className="mt-4 grid gap-2">
          <div className="flex items-center gap-2">
            <span className="eyebrow eyebrow-muted">Current document</span>
            <span className="flex-1" />
            <button type="button" onClick={copy} className="btn btn-ghost btn-sm">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <textarea
            readOnly
            value={current}
            rows={12}
            spellCheck={false}
            className="field font-mono text-[12px]"
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>

        <form action={formAction} className="mt-6 grid gap-2">
          <input type="hidden" name="unitId" value={unitId} />
          <input type="hidden" name="courseId" value={courseId} />
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">
              Replace document — paste JSON
            </span>
            <textarea
              name="json"
              rows={10}
              spellCheck={false}
              placeholder={'{ "version": 1, "blocks": [ … ] }\n\nor just: [ { "type": "richText", "markdown": "…" } ]'}
              className="field font-mono text-[12px]"
            />
          </label>

          {state ? (
            <p
              role="status"
              className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}
            >
              {state.message}
            </p>
          ) : null}

          <div>
            <button className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? "Importing…" : "Replace document"}
            </button>
          </div>
          <p className="font-mono text-[11px] text-muted">
            Unknown block types are skipped rather than rejected — a partial
            document still imports.
          </p>
        </form>
      </div>
    </details>
  );
}
