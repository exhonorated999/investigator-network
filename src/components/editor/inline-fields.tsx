"use client";

import { marked } from "marked";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

/**
 * Inline editing primitives.
 *
 * The guiding decision here is that these are REAL form controls styled to look
 * like the rendered output — not `contenteditable`. Two reasons:
 *
 *  1. The document's source of truth is markdown inside JSON. A contenteditable
 *     surface produces HTML, so every edit would need an HTML→markdown round
 *     trip, which is lossy and would quietly rewrite content the admin (or the
 *     agent) authored by hand.
 *  2. React and contenteditable fight over the DOM. Caret position, IME input
 *     and undo all become bespoke code.
 *
 * A transparent auto-sizing input that inherits the surrounding typography is
 * visually indistinguishable from the rendered text, and it just works.
 */

/** Parse markdown to HTML, never throwing. Mirrors md() in blocks/content.tsx. */
export function mdToHtml(markdown: string): string {
  const text = String(markdown ?? "").trim();
  if (!text) return "";
  try {
    return marked.parse(text, { async: false }) as string;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Single-line / short text
// ---------------------------------------------------------------------------

export function InlineText({
  value,
  onChange,
  placeholder,
  className,
  style,
  multiline,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  /** Typography classes copied from the renderer so the two match exactly. */
  className?: string;
  style?: CSSProperties;
  /** Wraps and grows instead of scrolling sideways. */
  multiline?: boolean;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-size before paint so the row never visibly jumps.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, multiline]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      aria-label={ariaLabel}
      placeholder={placeholder}
      spellCheck
      onChange={(e) => {
        const next = multiline
          ? e.target.value
          : // A single-line field must not accept newlines, including pasted
            // ones, or the stored value stops matching what is displayed.
            e.target.value.replace(/[\r\n]+/g, " ");
        onChange(next);
      }}
      onKeyDown={(e) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      className={`w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none placeholder:text-muted/45 focus:outline-none focus:ring-0 ${
        className ?? ""
      }`}
      style={style}
    />
  );
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

/**
 * Renders markdown; on click, swaps to a raw markdown textarea in place.
 *
 * The swap is the honest compromise. Rich text in this document IS markdown, so
 * pretending otherwise with a formatting-button toolbar would mean generating
 * markdown from HTML behind the admin's back. Showing the real source the
 * moment you click into it keeps what you edit and what is stored identical,
 * and the rendered view returns as soon as you click away.
 *
 * The `{ __html }` object below is memoized, and that is load-bearing rather
 * than an optimization. React 19 compares that prop by IDENTITY, so a fresh
 * object literal makes it re-apply innerHTML on every render — which destroys
 * and recreates the rendered nodes. When that happened mid-click, mousedown and
 * mouseup landed on two different elements and the browser never fired a click
 * at all, so this component could not be opened with the mouse.
 */
export function InlineMarkdown({
  value,
  onChange,
  placeholder,
  proseClass,
  ariaLabel,
  minRows = 3,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  /** PROSE or PROSE_INLINE, so the preview matches the learner view. */
  proseClass: string;
  ariaLabel: string;
  minRows?: number;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Must be computed before the `editing` early return below — hooks cannot be
  // called conditionally, and an early return above this is exactly the
  // "rendered fewer hooks than expected" trap.
  const html = useMemo(() => ({ __html: mdToHtml(value) }), [value]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !editing) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight, minRows * 22)}px`;
  }, [value, editing, minRows]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        spellCheck
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          // Escape leaves the field; plain Enter must stay a newline here.
          if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        className="w-full resize-none overflow-hidden border border-accent/40 bg-well-soft p-3 font-mono text-[13px] leading-relaxed text-foreground outline-none"
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${ariaLabel} — click to edit`}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      className="cursor-text rounded-sm outline-none ring-offset-2 focus-visible:ring-1 focus-visible:ring-accent"
    >
      {html.__html ? (
        <div className={proseClass} dangerouslySetInnerHTML={html} />
      ) : (
        <p className="py-2 text-[15px] italic text-muted/60">{placeholder}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Raw HTML (the escape-hatch block)
// ---------------------------------------------------------------------------

/**
 * Preview for the `html` block.
 *
 * Rendered inside a sandboxed iframe rather than with dangerouslySetInnerHTML.
 * The learner view sanitizes this HTML server-side with cheerio, which is far
 * too heavy to ship to the browser; a sandboxed frame gets the same protection
 * for free by refusing to run scripts at all. It also means a pasted snippet
 * cannot reach into the admin's own session while they are editing it.
 */
export function SandboxedHtml({ html }: { html: string }) {
  const doc = `<!doctype html><html><head><meta charset="utf-8">
<style>
  body { margin:0; font: 15px/1.5 system-ui, sans-serif; color:#e0e8f0; background:transparent; }
  a { color:#00b4d8; }
  img { max-width:100%; height:auto; }
</style></head><body>${html}</body></html>`;

  return (
    <iframe
      title="Raw HTML preview"
      sandbox=""
      srcDoc={doc}
      className="h-48 w-full border border-border bg-well"
    />
  );
}
