"use client";

import type {
  CalloutBlock,
  CalloutVariant,
  CardBlock,
  ColumnsBlock,
  DividerBlock,
  HeadingBlock,
  HtmlBlock,
  QuoteBlock,
  RichTextBlock,
  TableBlock,
} from "@/lib/blocks";
import { PROSE, PROSE_INLINE } from "@/components/blocks/prose";
import { useEditor } from "./editor-store";
import { InlineMarkdown, InlineText, SandboxedHtml } from "./inline-fields";
import { EditableList } from "./canvas";
import { SlotFrame } from "./block-frame";
import {
  AddItemButton,
  ItemControls,
  NoProps,
  PropGroup,
  PropSelect,
} from "./fields";

/**
 * Editable surfaces for the content and layout block types.
 *
 * THE PATTERN, which the media and interactive groups follow:
 *
 *  1. Each `Edit*` component renders the block as closely as possible to its
 *     counterpart in `src/components/blocks/`, with every reader-facing string
 *     swapped for an `InlineText` / `InlineMarkdown` carrying the SAME
 *     typography classes. Read the renderer before writing the editor — if the
 *     two drift, the canvas stops being a preview and becomes a lie.
 *  2. Empty values render a placeholder instead of collapsing to nothing. The
 *     renderers return null for empty text, which is right for a learner and
 *     useless for an author who then has nothing to click.
 *  3. Structural settings never appear on the canvas; they go in the matching
 *     `*Props` component for the properties rail.
 *  4. Mutations go through `patch(block.id, { … })` from the editor store.
 *     Never mutate a block object in place — undo depends on old trees staying
 *     untouched.
 */

// ---------------------------------------------------------------------------
// richText
// ---------------------------------------------------------------------------

export function EditRichText({ block }: { block: RichTextBlock }) {
  const { patch } = useEditor();
  return (
    <InlineMarkdown
      value={block.markdown}
      onChange={(markdown) => patch(block.id, { markdown })}
      placeholder="Write your notes in markdown…"
      proseClass={PROSE}
      ariaLabel="Rich text content"
      minRows={4}
    />
  );
}

// ---------------------------------------------------------------------------
// heading
// ---------------------------------------------------------------------------

export function EditHeading({ block }: { block: HeadingBlock }) {
  const { patch } = useEditor();
  const sizeClass =
    block.level === 2
      ? "text-xl text-accent-bright"
      : block.level === 3
        ? "text-lg"
        : "text-base text-muted";

  return (
    <div>
      <InlineText
        value={block.eyebrow}
        onChange={(eyebrow) => patch(block.id, { eyebrow })}
        placeholder="Kicker (optional)"
        ariaLabel="Heading kicker"
        className="eyebrow mb-1 block"
      />
      <InlineText
        value={block.text}
        onChange={(text) => patch(block.id, { text })}
        placeholder="Heading"
        ariaLabel="Heading text"
        className={`font-display font-bold uppercase tracking-wide ${sizeClass}`}
      />
    </div>
  );
}

export function HeadingProps({ block }: { block: HeadingBlock }) {
  const { patch } = useEditor();
  return (
    <PropGroup label="Heading">
      <PropSelect
        label="Level"
        value={String(block.level) as "2" | "3" | "4"}
        onChange={(v) => patch(block.id, { level: Number(v) as 2 | 3 | 4 })}
        options={[
          { value: "2", label: "H2 — section" },
          { value: "3", label: "H3 — subsection" },
          { value: "4", label: "H4 — minor" },
        ]}
      />
    </PropGroup>
  );
}

// ---------------------------------------------------------------------------
// callout
// ---------------------------------------------------------------------------

const CALLOUT_EDIT: Record<
  CalloutVariant,
  { border: string; tint: string; icon: string; label: string }
> = {
  note: { border: "border-l-accent", tint: "bg-[rgba(0,180,216,0.06)]", icon: "ℹ", label: "NOTE" },
  warning: { border: "border-l-gold", tint: "bg-[rgba(244,162,97,0.06)]", icon: "⚠", label: "WARNING" },
  critical: { border: "border-l-danger", tint: "bg-[rgba(239,68,68,0.06)]", icon: "!", label: "CRITICAL" },
  success: { border: "border-l-success", tint: "bg-[rgba(74,222,128,0.06)]", icon: "✓", label: "SUCCESS" },
  evidence: { border: "border-l-purple", tint: "bg-[rgba(168,85,247,0.06)]", icon: "⬢", label: "EVIDENCE" },
};

export function EditCallout({ block }: { block: CalloutBlock }) {
  const { patch } = useEditor();
  const s = CALLOUT_EDIT[block.variant] ?? CALLOUT_EDIT.note;
  return (
    <div className={`border-l-2 ${s.border} ${s.tint} p-4`}>
      <div className="mb-1 flex items-center gap-2">
        <span className="font-mono text-[13px] text-accent">{s.icon}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          {s.label}
        </span>
      </div>
      <InlineText
        value={block.title}
        onChange={(title) => patch(block.id, { title })}
        placeholder="Callout title (optional)"
        ariaLabel="Callout title"
        className="font-display text-[15px] font-bold uppercase tracking-wide text-foreground"
      />
      <div className="mt-1">
        <InlineMarkdown
          value={block.markdown}
          onChange={(markdown) => patch(block.id, { markdown })}
          placeholder="What should the learner take from this?"
          proseClass={PROSE_INLINE}
          ariaLabel="Callout body"
          minRows={2}
        />
      </div>
    </div>
  );
}

export function CalloutProps({ block }: { block: CalloutBlock }) {
  const { patch } = useEditor();
  return (
    <PropGroup label="Callout">
      <PropSelect
        label="Variant"
        value={block.variant}
        onChange={(variant) => patch(block.id, { variant })}
        options={[
          { value: "note", label: "Note" },
          { value: "warning", label: "Warning" },
          { value: "critical", label: "Critical" },
          { value: "success", label: "Success" },
          { value: "evidence", label: "Evidence" },
        ]}
      />
    </PropGroup>
  );
}

// ---------------------------------------------------------------------------
// quote
// ---------------------------------------------------------------------------

export function EditQuote({ block }: { block: QuoteBlock }) {
  const { patch } = useEditor();
  return (
    <blockquote className="border-l-2 border-accent/40 pl-5">
      <InlineText
        value={block.text}
        onChange={(text) => patch(block.id, { text })}
        placeholder="The quotation…"
        ariaLabel="Quote text"
        multiline
        className="font-display text-lg italic text-foreground"
      />
      <InlineText
        value={block.attribution}
        onChange={(attribution) => patch(block.id, { attribution })}
        placeholder="Attribution (optional)"
        ariaLabel="Quote attribution"
        className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-muted"
      />
    </blockquote>
  );
}

// ---------------------------------------------------------------------------
// table
// ---------------------------------------------------------------------------

export function EditTable({ block }: { block: TableBlock }) {
  const { patch } = useEditor();
  return (
    <figure>
      <InlineMarkdown
        value={block.markdown}
        onChange={(markdown) => patch(block.id, { markdown })}
        placeholder={"| Column | Column |\n| --- | --- |\n| Cell | Cell |"}
        proseClass={PROSE}
        ariaLabel="Table markdown"
        minRows={4}
      />
      <figcaption className="mt-2 text-center">
        <InlineText
          value={block.caption}
          onChange={(caption) => patch(block.id, { caption })}
          placeholder="Caption (optional)"
          ariaLabel="Table caption"
          className="text-center font-mono text-xs uppercase tracking-[0.14em] text-muted"
        />
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// divider
// ---------------------------------------------------------------------------

export function EditDivider({ block }: { block: DividerBlock }) {
  const { patch } = useEditor();
  return (
    <div className="flex items-center gap-4 py-2">
      <hr className="flex-1 border-0 border-t border-border" />
      <div className="min-w-24 max-w-[16rem]">
        <InlineText
          value={block.label}
          onChange={(label) => patch(block.id, { label })}
          placeholder="Label (optional)"
          ariaLabel="Divider label"
          className="eyebrow eyebrow-muted text-center"
        />
      </div>
      <hr className="flex-1 border-0 border-t border-border" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// html
// ---------------------------------------------------------------------------

export function EditHtml({ block }: { block: HtmlBlock }) {
  const { patch } = useEditor();
  return (
    <div className="grid gap-2">
      <textarea
        value={block.html}
        onChange={(e) => patch(block.id, { html: e.target.value })}
        placeholder="<div>…</div>"
        aria-label="Raw HTML"
        rows={5}
        className="w-full resize-y border border-border bg-well-soft p-3 font-mono text-[12px] text-foreground outline-none focus:border-accent"
      />
      <SandboxedHtml html={block.html} />
      <p className="text-[11px] text-muted">
        Previewed in a sandbox. The learner view sanitizes this HTML on the
        server, so scripts and unsafe URLs are stripped there too.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// columns
// ---------------------------------------------------------------------------

const GAP_CLASS: Record<ColumnsBlock["gap"], string> = {
  sm: "gap-4",
  md: "gap-6",
  lg: "gap-8",
};

export function EditColumns({
  block,
  depth,
}: {
  block: ColumnsBlock;
  depth: number;
}) {
  const cols = block.columns;
  const colClass = cols.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <div className={`grid grid-cols-1 ${colClass} ${GAP_CLASS[block.gap] ?? GAP_CLASS.md}`}>
      {cols.map((col, i) => (
        <SlotFrame key={i} label={`Column ${i + 1}`}>
          <EditableList
            listRef={{ parentId: block.id, slot: i }}
            blocks={col}
            depth={depth + 1}
            emptyHint="Empty column"
          />
        </SlotFrame>
      ))}
    </div>
  );
}

export function ColumnsProps({ block }: { block: ColumnsBlock }) {
  const { patch } = useEditor();
  const cols = block.columns;
  return (
    <PropGroup label="Columns">
      <PropSelect
        label="Gap"
        value={block.gap}
        onChange={(gap) => patch(block.id, { gap })}
        options={[
          { value: "sm", label: "Tight" },
          { value: "md", label: "Normal" },
          { value: "lg", label: "Wide" },
        ]}
      />
      <div className="grid gap-2">
        {cols.map((col, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <span className="text-[13px] text-muted">
              Column {i + 1}
              <span className="ml-1 font-mono text-[11px] text-muted/70">
                ({col.length})
              </span>
            </span>
            <ItemControls
              removeLabel={`Remove column ${i + 1}`}
              // Below two, it stops being a columns block; and a column with
              // content in it should not vanish on a single click.
              disabled={cols.length <= 2 || col.length > 0}
              onRemove={() =>
                patch(block.id, { columns: cols.filter((_, j) => j !== i) })
              }
            />
          </div>
        ))}
        {cols.length < 3 ? (
          <AddItemButton
            label="Add column"
            onClick={() => patch(block.id, { columns: [...cols, []] })}
          />
        ) : null}
        <p className="text-[11px] text-muted">
          A column has to be emptied before it can be removed.
        </p>
      </div>
    </PropGroup>
  );
}

// ---------------------------------------------------------------------------
// card
// ---------------------------------------------------------------------------

export function EditCard({ block, depth }: { block: CardBlock; depth: number }) {
  const { patch } = useEditor();
  return (
    <div className="panel rule-top p-5">
      <InlineText
        value={block.eyebrow}
        onChange={(eyebrow) => patch(block.id, { eyebrow })}
        placeholder="Kicker (optional)"
        ariaLabel="Card kicker"
        className="eyebrow mb-1 block"
      />
      <InlineText
        value={block.title}
        onChange={(title) => patch(block.id, { title })}
        placeholder="Card title (optional)"
        ariaLabel="Card title"
        className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-accent-bright"
      />
      <EditableList
        listRef={{ parentId: block.id, slot: 0 }}
        blocks={block.blocks}
        depth={depth + 1}
        emptyHint="Empty card"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Properties dispatcher for this group
// ---------------------------------------------------------------------------

export function ContentProps({
  block,
}: {
  block:
    | RichTextBlock
    | HeadingBlock
    | CalloutBlock
    | QuoteBlock
    | TableBlock
    | DividerBlock
    | HtmlBlock
    | ColumnsBlock
    | CardBlock;
}) {
  switch (block.type) {
    case "heading":
      return <HeadingProps block={block} />;
    case "callout":
      return <CalloutProps block={block} />;
    case "columns":
      return <ColumnsProps block={block} />;
    case "richText":
      return <NoProps what="Text" />;
    case "quote":
      return <NoProps what="A quote" />;
    case "table":
      return <NoProps what="A table" />;
    case "divider":
      return <NoProps what="A divider" />;
    case "html":
      return <NoProps what="Raw HTML" />;
    case "card":
      return <NoProps what="A card" />;
  }
}
