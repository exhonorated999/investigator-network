import { marked } from "marked";
import type {
  RichTextBlock,
  HeadingBlock,
  CalloutBlock,
  CalloutVariant,
  QuoteBlock,
  TableBlock,
  DividerBlock,
  HtmlBlock,
} from "@/lib/blocks";
import { PROSE, PROSE_INLINE } from "./prose";
import { sanitizeHtml } from "@/lib/sanitize-html";

/** Parse markdown to HTML string, never throwing. */
function md(markdown: string): string {
  const text = String(markdown ?? "").trim();
  if (!text) return "";
  try {
    return marked.parse(text, { async: false }) as string;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// richText
// ---------------------------------------------------------------------------

export function RichTextBlockView({ block }: { block: RichTextBlock }) {
  const html = md(block.markdown);
  if (!html) return null;
  return (
    <article
      className={PROSE}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ---------------------------------------------------------------------------
// heading
// ---------------------------------------------------------------------------

export function HeadingBlockView({ block }: { block: HeadingBlock }) {
  const text = block.text.trim();
  if (!text) return null;
  const Tag = (`h${block.level}` as "h2" | "h3" | "h4");
  const sizeClass =
    block.level === 2
      ? "text-xl text-accent-bright"
      : block.level === 3
        ? "text-lg"
        : "text-base text-muted";
  return (
    <div>
      {block.eyebrow.trim() ? (
        <span className="eyebrow mb-1 block">{block.eyebrow}</span>
      ) : null}
      <Tag
        className={`font-display font-bold uppercase tracking-wide ${sizeClass}`}
      >
        {text}
      </Tag>
    </div>
  );
}

// ---------------------------------------------------------------------------
// callout
// ---------------------------------------------------------------------------

const CALLOUT_STYLES: Record<
  CalloutVariant,
  { border: string; tint: string; icon: string; label: string; rule: string }
> = {
  note: {
    border: "border-l-accent",
    tint: "bg-[rgba(0,180,216,0.06)]",
    icon: "ℹ",
    label: "NOTE",
    rule: "rule-top",
  },
  warning: {
    border: "border-l-gold",
    tint: "bg-[rgba(244,162,97,0.06)]",
    icon: "⚠",
    label: "WARNING",
    rule: "rule-top-gold",
  },
  critical: {
    border: "border-l-danger",
    tint: "bg-[rgba(239,68,68,0.06)]",
    icon: "✖",
    label: "CRITICAL",
    rule: "rule-top-danger",
  },
  success: {
    border: "border-l-success",
    tint: "bg-[rgba(74,222,128,0.06)]",
    icon: "✓",
    label: "SUCCESS",
    rule: "",
  },
  evidence: {
    border: "border-l-purple",
    tint: "bg-[rgba(168,85,247,0.06)]",
    icon: "◆",
    label: "EVIDENCE",
    rule: "",
  },
};

export function CalloutBlockView({ block }: { block: CalloutBlock }) {
  const body = md(block.markdown);
  const style = CALLOUT_STYLES[block.variant] ?? CALLOUT_STYLES.note;
  const title = block.title.trim();

  return (
    <div
      className={`panel ${style.rule} ${style.tint} border-l-2 ${style.border} p-5`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-sm" aria-hidden>
          {style.icon}
        </span>
        <span className="eyebrow eyebrow-muted">{style.label}</span>
      </div>
      {title ? (
        <p className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-foreground">
          {title}
        </p>
      ) : null}
      {body ? (
        <div
          className={PROSE_INLINE}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// quote
// ---------------------------------------------------------------------------

export function QuoteBlockView({ block }: { block: QuoteBlock }) {
  const text = block.text.trim();
  if (!text) return null;
  const attribution = block.attribution.trim();
  return (
    <blockquote className="border-l-2 border-accent/40 pl-5">
      <p className="font-display text-lg italic text-foreground">&ldquo;{text}&rdquo;</p>
      {attribution ? (
        <footer className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-muted">
          — {attribution}
        </footer>
      ) : null}
    </blockquote>
  );
}

// ---------------------------------------------------------------------------
// table
// ---------------------------------------------------------------------------

export function TableBlockView({ block }: { block: TableBlock }) {
  const html = md(block.markdown);
  if (!html) return null;
  const caption = block.caption.trim();
  return (
    <figure>
      <article
        className={PROSE}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {caption ? (
        <figcaption className="mt-2 text-center font-mono text-xs uppercase tracking-[0.14em] text-muted">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// divider
// ---------------------------------------------------------------------------

export function DividerBlockView({ block }: { block: DividerBlock }) {
  const label = block.label.trim();
  if (!label) {
    return <hr className="border-0 border-t border-border" />;
  }
  return (
    <div className="flex items-center gap-4">
      <hr className="flex-1 border-0 border-t border-border" />
      <span className="eyebrow eyebrow-muted whitespace-nowrap">{label}</span>
      <hr className="flex-1 border-0 border-t border-border" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// html
// ---------------------------------------------------------------------------

export function HtmlBlockView({ block }: { block: HtmlBlock }) {
  const clean = sanitizeHtml(block.html);
  if (!clean) return null;
  return (
    <div
      className="text-foreground [&_a]:text-accent [&_a]:underline [&_a:hover]:text-accent-bright [&_img]:max-w-full [&_img]:h-auto"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
