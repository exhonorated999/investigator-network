"use client";

import { useState } from "react";
import { BLOCK_LABEL, countBlocks, parseBlocks } from "@/lib/blocks";
import { findBlockById } from "@/lib/notes-doc";
import { EditorProvider, useEditor } from "./editor-store";
import { DragProvider, EditableList } from "./canvas";
import { BlockProps } from "./editable-blocks";
import type { Block } from "@/lib/blocks";

/**
 * The visual notes editor.
 *
 * Three regions: a status/undo bar, the canvas (which is the page as the
 * learner will see it, but typed into directly), and a properties rail for the
 * selected block. There is no Save button — see `editor-store.tsx` for why, and
 * for what replaces it.
 */
export function NotesEditor({
  unitId,
  initialBlocks,
}: {
  unitId: string;
  initialBlocks: Block[];
}) {
  return (
    <EditorProvider unitId={unitId} initialBlocks={initialBlocks}>
      <DragProvider>
        <Shell />
      </DragProvider>
    </EditorProvider>
  );
}

function Shell() {
  const { blocks, selectedId } = useEditor();
  const selected = selectedId ? findBlockById(blocks, selectedId) : null;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="eyebrow eyebrow-gold">03 / Course notes</p>
        <span className="font-mono text-[11px] text-muted">
          {countBlocks(blocks)} block{countBlocks(blocks) === 1 ? "" : "s"}
        </span>
      </div>

      <StatusBar />

      <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Canvas. Clicking the background deselects, which is how you get the
            properties rail to stop pointing at something. */}
        <div className="min-w-0">
          <div className="panel rule-top p-5 sm:p-8">
            <EditableList
              blocks={blocks}
              emptyHint="This page is empty. Hover the line above and press + to add your first block."
            />
          </div>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <div className="border border-border bg-well-soft p-4">
            <p className="eyebrow eyebrow-gold">
              {selected ? BLOCK_LABEL[selected.type] : "Nothing selected"}
            </p>
            <div className="mt-3 grid gap-4">
              {selected ? (
                <BlockProps block={selected} />
              ) : (
                <p className="text-[13px] text-muted">
                  Click a block to see its settings. Text is edited directly on
                  the page.
                </p>
              )}
            </div>
          </div>

          <JsonEscapeHatch />
        </aside>
      </div>
    </section>
  );
}

function StatusBar() {
  const { saveState, lastSavedAt, canUndo, canRedo, undo, redo, saveNow } =
    useEditor();

  const label =
    saveState === "saving"
      ? "Saving…"
      : saveState === "dirty"
        ? "Unsaved changes"
        : saveState === "error"
          ? "Save failed — retrying on next edit"
          : lastSavedAt
            ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`
            : "Up to date";

  const tone =
    saveState === "error"
      ? "text-danger"
      : saveState === "saving" || saveState === "dirty"
        ? "text-gold"
        : "text-muted";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-y border-border py-2">
      <button
        type="button"
        onClick={undo}
        disabled={!canUndo}
        className="btn btn-ghost btn-sm disabled:opacity-30"
        title="Undo (Ctrl+Z)"
      >
        ↺ Undo
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        className="btn btn-ghost btn-sm disabled:opacity-30"
        title="Redo (Ctrl+Shift+Z)"
      >
        ↻ Redo
      </button>

      <span className="flex-1" />

      <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${tone}`}>
        {label}
      </span>
      <button
        type="button"
        onClick={saveNow}
        className="btn btn-ghost btn-sm"
        title="Save now (Ctrl+S)"
      >
        Save now
      </button>
    </div>
  );
}

/**
 * Raw JSON in and out.
 *
 * Kept deliberately, and kept prominent. The whole point of this document
 * format is that a whole notebook can be authored outside the UI and pasted in
 * — a visual editor that could only produce what its own controls expose would
 * be a downgrade, not an upgrade.
 */
function JsonEscapeHatch() {
  const { blocks, replaceAll } = useEditor();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <details className="mt-4 border border-border bg-well-soft">
      <summary className="cursor-pointer list-none px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent transition hover:text-accent-bright">
        JSON source
      </summary>
      <div className="border-t border-border p-3">
        <textarea
          value={draft ?? JSON.stringify(blocks, null, 2)}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          spellCheck={false}
          rows={14}
          aria-label="Block document JSON"
          className="w-full resize-y border border-border bg-well p-2 font-mono text-[11px] leading-relaxed text-foreground outline-none focus:border-accent"
        />
        {error ? (
          <p className="mt-2 text-[12px] text-danger">{error}</p>
        ) : null}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={draft === null}
            onClick={() => {
              if (draft === null) return;
              try {
                const parsed: unknown = JSON.parse(draft);
                if (!Array.isArray(parsed)) {
                  setError("Expected an array of blocks.");
                  return;
                }
                // Run it through the same tolerant parser the server uses, so
                // what you get is exactly what would have been stored.
                replaceAll(parseBlocks(parsed));
                setDraft(null);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Invalid JSON");
              }
            }}
          >
            Apply
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={draft === null}
            onClick={() => {
              setDraft(null);
              setError(null);
            }}
          >
            Discard
          </button>
        </div>
      </div>
    </details>
  );
}
