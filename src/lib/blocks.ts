/**
 * Course Notes block document.
 *
 * A NOTES unit's `data` blob holds a recursive tree of blocks. This module is
 * the single source of truth for that shape: the learner renderer, the admin
 * editor, and any hand-authored JSON all go through `parseBlocks`.
 *
 * Two rules drive the design:
 *
 * 1. **Never throw.** A notes document can be typed by hand or pasted in
 *    wholesale. `parseBlocks` normalizes what it can and silently drops what it
 *    cannot, so a malformed document degrades to a shorter page rather than a
 *    white screen for a learner.
 *
 * 2. **The JSON is the API.** The visual editor is one client of this format,
 *    not the only way in. Anything expressible here is buildable, whether it
 *    was clicked together or written directly into the source view.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BlockType =
  // content
  | "richText"
  | "heading"
  | "callout"
  | "quote"
  | "table"
  | "divider"
  // media & resources
  | "image"
  | "video"
  | "pdf"
  | "embed"
  | "fileList"
  | "email"
  // layout
  | "columns"
  | "accordion"
  | "tabs"
  | "card"
  // interactive
  | "checklist"
  | "knowledgeCheck"
  | "revealCard"
  | "scenario"
  | "ordering"
  // escape hatch
  | "html";

export type CalloutVariant =
  | "note"
  | "warning"
  | "critical"
  | "success"
  | "evidence";

export type MediaWidth = "normal" | "wide" | "full";

interface Base<T extends BlockType> {
  id: string;
  type: T;
}

export interface RichTextBlock extends Base<"richText"> {
  markdown: string;
}

export interface HeadingBlock extends Base<"heading"> {
  /** Rendered as h2/h3/h4. h1 is reserved for the unit title. */
  level: 2 | 3 | 4;
  text: string;
  /** Small uppercase kicker above the heading, e.g. "01 / BACKGROUND". */
  eyebrow: string;
}

export interface CalloutBlock extends Base<"callout"> {
  variant: CalloutVariant;
  title: string;
  markdown: string;
}

export interface QuoteBlock extends Base<"quote"> {
  text: string;
  attribution: string;
}

export interface TableBlock extends Base<"table"> {
  /** A GitHub-flavoured markdown table. */
  markdown: string;
  caption: string;
}

export interface DividerBlock extends Base<"divider"> {
  label: string;
}

export interface ImageBlock extends Base<"image"> {
  /** Uploaded asset (`/api/files/…`) or an external URL. */
  url: string;
  alt: string;
  caption: string;
  width: MediaWidth;
}

export interface VideoBlock extends Base<"video"> {
  provider: "youtube" | "bunny";
  videoId: string;
  libraryId: string;
  title: string;
  durationSec: number;
}

export interface PdfBlock extends Base<"pdf"> {
  url: string;
  title: string;
  /** Viewer height in px. 0 uses the default. */
  height: number;
  /** Show a download button under the viewer. */
  downloadable: boolean;
}

export interface EmbedBlock extends Base<"embed"> {
  /** Already normalized by `lib/embed.ts` when saved through the editor. */
  url: string;
  title: string;
  height: number;
}

export interface FileListItem {
  id: string;
  url: string;
  label: string;
  description: string;
  /** Free text, e.g. "PDF · 2.4 MB". Display only. */
  meta: string;
}

export interface FileListBlock extends Base<"fileList"> {
  title: string;
  items: FileListItem[];
}

/**
 * A rendered email artifact. Training material in this domain leans heavily on
 * "here is the message that came in" — reproducing it as a styled envelope
 * reads far better than a screenshot and stays selectable/searchable.
 */
export interface EmailBlock extends Base<"email"> {
  from: string;
  to: string;
  cc: string;
  date: string;
  subject: string;
  /** Markdown, so the body can carry lists and emphasis. */
  bodyMarkdown: string;
  attachments: string[];
}

export interface ColumnsBlock extends Base<"columns"> {
  /** 2 or 3 columns. Each column is an independent block list. */
  columns: Block[][];
  /** Stack on mobile regardless of column count. */
  gap: "sm" | "md" | "lg";
}

export interface AccordionItem {
  id: string;
  title: string;
  /** Open on first render. */
  open: boolean;
  blocks: Block[];
}

export interface AccordionBlock extends Base<"accordion"> {
  title: string;
  /** Only one panel open at a time. */
  exclusive: boolean;
  items: AccordionItem[];
}

export interface TabsItem {
  id: string;
  label: string;
  blocks: Block[];
}

export interface TabsBlock extends Base<"tabs"> {
  items: TabsItem[];
}

export interface CardBlock extends Base<"card"> {
  title: string;
  eyebrow: string;
  blocks: Block[];
}

export interface ChecklistItem {
  id: string;
  text: string;
}

export interface ChecklistBlock extends Base<"checklist"> {
  title: string;
  items: ChecklistItem[];
  /** Must be satisfied before the unit can be marked complete. */
  required: boolean;
}

export interface KnowledgeChoice {
  id: string;
  text: string;
  correct: boolean;
}

/**
 * A self-check. Answers are recorded per learner (see `lib/interactions.ts`) so
 * a notes page can gate completion and surface "most-missed question" stats,
 * but it stays out of the gradebook — graded assessment is the QUIZ unit type.
 */
export interface KnowledgeCheckBlock extends Base<"knowledgeCheck"> {
  question: string;
  choices: KnowledgeChoice[];
  explanation: string;
  required: boolean;
  /** When true, answering is not enough — the answer must be right. */
  requireCorrect: boolean;
}

export interface RevealCardBlock extends Base<"revealCard"> {
  front: string;
  /** Markdown, revealed on click. */
  backMarkdown: string;
  required: boolean;
}

export interface ScenarioOption {
  id: string;
  text: string;
  /** Markdown consequence shown once this option is chosen. */
  outcomeMarkdown: string;
  /** Marks this as a defensible decision. */
  correct: boolean;
}

/**
 * A decision point. The learner picks one course of action and is shown the
 * consequence — the closest thing in the block set to real judgement practice.
 */
export interface ScenarioBlock extends Base<"scenario"> {
  title: string;
  promptMarkdown: string;
  options: ScenarioOption[];
  required: boolean;
  /** When true, gating is only satisfied by choosing a `correct` option. */
  requireCorrect: boolean;
}

export interface OrderingItem {
  id: string;
  text: string;
}

/**
 * Drag-to-order. The authored order IS the correct order; the learner is shown
 * a shuffled copy and has to restore it.
 */
export interface OrderingBlock extends Base<"ordering"> {
  title: string;
  promptMarkdown: string;
  items: OrderingItem[];
  required: boolean;
}

export interface HtmlBlock extends Base<"html"> {
  /** Sanitized at render time. Admin-authored only. */
  html: string;
}

export type Block =
  | RichTextBlock
  | HeadingBlock
  | CalloutBlock
  | QuoteBlock
  | TableBlock
  | DividerBlock
  | ImageBlock
  | VideoBlock
  | PdfBlock
  | EmbedBlock
  | FileListBlock
  | EmailBlock
  | ColumnsBlock
  | AccordionBlock
  | TabsBlock
  | CardBlock
  | ChecklistBlock
  | KnowledgeCheckBlock
  | RevealCardBlock
  | ScenarioBlock
  | OrderingBlock
  | HtmlBlock;

/** Block types that hold other blocks — the editor needs to know for nesting. */
export const CONTAINER_TYPES: BlockType[] = [
  "columns",
  "accordion",
  "tabs",
  "card",
];

export function isContainer(block: Block): boolean {
  return CONTAINER_TYPES.includes(block.type);
}

/**
 * Block types that record per-learner state on the server. Each one has a
 * `required` flag; when set, the unit cannot be marked complete until the
 * learner has satisfied it.
 */
export const INTERACTIVE_TYPES = [
  "checklist",
  "knowledgeCheck",
  "revealCard",
  "scenario",
  "ordering",
] as const;

export type InteractiveType = (typeof INTERACTIVE_TYPES)[number];

export type InteractiveBlock =
  | ChecklistBlock
  | KnowledgeCheckBlock
  | RevealCardBlock
  | ScenarioBlock
  | OrderingBlock;

export function isInteractive(block: Block): block is InteractiveBlock {
  return (INTERACTIVE_TYPES as readonly string[]).includes(block.type);
}

// ---------------------------------------------------------------------------
// Catalog — drives the "add block" palette
// ---------------------------------------------------------------------------

export type BlockGroup = "Content" | "Media" | "Layout" | "Interactive" | "Advanced";

export interface BlockMeta {
  type: BlockType;
  label: string;
  description: string;
  group: BlockGroup;
  icon: string;
}

export const BLOCK_CATALOG: BlockMeta[] = [
  { type: "richText", label: "Text", description: "Markdown prose — headings, lists, links, emphasis.", group: "Content", icon: "¶" },
  { type: "heading", label: "Heading", description: "Section heading with an optional kicker.", group: "Content", icon: "H" },
  { type: "callout", label: "Callout", description: "Boxed note, warning, or evidence highlight.", group: "Content", icon: "!" },
  { type: "quote", label: "Quote", description: "Pull quote with attribution.", group: "Content", icon: "❝" },
  { type: "table", label: "Table", description: "Markdown table with an optional caption.", group: "Content", icon: "▦" },
  { type: "divider", label: "Divider", description: "Horizontal rule, optionally labelled.", group: "Content", icon: "—" },

  { type: "image", label: "Image", description: "Uploaded or linked image with a caption.", group: "Media", icon: "🖼" },
  { type: "video", label: "Video", description: "YouTube or Bunny Stream player.", group: "Media", icon: "▶" },
  { type: "pdf", label: "PDF", description: "Inline PDF viewer with download.", group: "Media", icon: "📄" },
  { type: "embed", label: "Embed", description: "Flipbook, Google Slides, Canva, or any iframe.", group: "Media", icon: "⧉" },
  { type: "fileList", label: "Downloads", description: "A list of downloadable resources.", group: "Media", icon: "⬇" },
  { type: "email", label: "Email", description: "A rendered email artifact for case material.", group: "Media", icon: "✉" },

  { type: "columns", label: "Columns", description: "Two or three side-by-side columns.", group: "Layout", icon: "▥" },
  { type: "accordion", label: "Accordion", description: "Collapsible panels — good for FAQs.", group: "Layout", icon: "▤" },
  { type: "tabs", label: "Tabs", description: "Tabbed panels sharing one area.", group: "Layout", icon: "▭" },
  { type: "card", label: "Card", description: "A bordered container around other blocks.", group: "Layout", icon: "▢" },

  { type: "checklist", label: "Checklist", description: "Tickable list; ticks are saved to the learner's record.", group: "Interactive", icon: "☑" },
  { type: "knowledgeCheck", label: "Knowledge check", description: "Self-check with a revealed answer and explanation.", group: "Interactive", icon: "?" },
  { type: "revealCard", label: "Reveal card", description: "Click to flip and show the answer.", group: "Interactive", icon: "⇄" },
  { type: "scenario", label: "Scenario", description: "Decision point — pick a course of action, see the consequence.", group: "Interactive", icon: "⑂" },
  { type: "ordering", label: "Put in order", description: "Drag shuffled steps back into the correct sequence.", group: "Interactive", icon: "⇅" },

  { type: "html", label: "Raw HTML", description: "Escape hatch for anything not covered above.", group: "Advanced", icon: "</>" },
];

export const BLOCK_LABEL: Record<BlockType, string> = Object.fromEntries(
  BLOCK_CATALOG.map((b) => [b.type, b.label])
) as Record<BlockType, string>;

export const BLOCK_GROUPS: BlockGroup[] = [
  "Content",
  "Media",
  "Layout",
  "Interactive",
  "Advanced",
];

// ---------------------------------------------------------------------------
// Coercion helpers
// ---------------------------------------------------------------------------

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function str(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return fallback;
}

function bool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}

function int(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  const s = str(v).trim();
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

let idCounter = 0;
/**
 * Stable-enough id for a block. Blocks live inside a JSON blob, not their own
 * table, so ids only need to be unique within one document — they are used as
 * React keys and as form field targets.
 */
export function newBlockId(): string {
  idCounter += 1;
  return `b${Date.now().toString(36)}${idCounter.toString(36)}`;
}

function idOf(v: unknown): string {
  const s = str(v).trim();
  return s || newBlockId();
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const ALL_TYPES = new Set<string>(BLOCK_CATALOG.map((b) => b.type));

/**
 * Depth ceiling for nested containers. Prevents a hand-authored (or
 * maliciously deep) document from blowing the render stack.
 */
const MAX_DEPTH = 6;

/**
 * Normalize an unknown value into a block list. Anything unrecognized is
 * dropped rather than rejected, so partial documents still render.
 */
export function parseBlocks(value: unknown, depth = 0): Block[] {
  if (depth > MAX_DEPTH) return [];
  const out: Block[] = [];
  for (const raw of arr(value)) {
    const block = parseBlock(raw, depth);
    if (block) out.push(block);
  }
  return out;
}

function parseBlock(raw: unknown, depth: number): Block | null {
  const o = rec(raw);
  const type = str(o.type).trim();
  if (!ALL_TYPES.has(type)) return null;

  const id = idOf(o.id);
  const kids = (v: unknown) => parseBlocks(v, depth + 1);

  switch (type as BlockType) {
    case "richText":
      return { id, type: "richText", markdown: str(o.markdown) };

    case "heading":
      return {
        id,
        type: "heading",
        level: ([2, 3, 4] as const).includes(int(o.level, 2) as 2 | 3 | 4)
          ? (int(o.level, 2) as 2 | 3 | 4)
          : 2,
        text: str(o.text),
        eyebrow: str(o.eyebrow),
      };

    case "callout":
      return {
        id,
        type: "callout",
        variant: oneOf(
          o.variant,
          ["note", "warning", "critical", "success", "evidence"] as const,
          "note"
        ),
        title: str(o.title),
        markdown: str(o.markdown),
      };

    case "quote":
      return {
        id,
        type: "quote",
        text: str(o.text),
        attribution: str(o.attribution),
      };

    case "table":
      return {
        id,
        type: "table",
        markdown: str(o.markdown),
        caption: str(o.caption),
      };

    case "divider":
      return { id, type: "divider", label: str(o.label) };

    case "image":
      return {
        id,
        type: "image",
        url: safeUrl(str(o.url)),
        alt: str(o.alt),
        caption: str(o.caption),
        width: oneOf(o.width, ["normal", "wide", "full"] as const, "normal"),
      };

    case "video":
      return {
        id,
        type: "video",
        provider: oneOf(o.provider, ["youtube", "bunny"] as const, "youtube"),
        videoId: str(o.videoId).trim(),
        libraryId: str(o.libraryId).trim(),
        title: str(o.title),
        durationSec: Math.max(0, int(o.durationSec, 0)),
      };

    case "pdf":
      return {
        id,
        type: "pdf",
        url: safeUrl(str(o.url)),
        title: str(o.title),
        height: Math.max(0, int(o.height, 0)),
        downloadable: bool(o.downloadable, true),
      };

    case "embed":
      return {
        id,
        type: "embed",
        url: safeUrl(str(o.url)),
        title: str(o.title),
        height: Math.max(0, int(o.height, 0)),
      };

    case "fileList":
      return {
        id,
        type: "fileList",
        title: str(o.title),
        items: arr(o.items).map((it) => {
          const i = rec(it);
          return {
            id: idOf(i.id),
            url: safeUrl(str(i.url)),
            label: str(i.label),
            description: str(i.description),
            meta: str(i.meta),
          };
        }),
      };

    case "email":
      return {
        id,
        type: "email",
        from: str(o.from),
        to: str(o.to),
        cc: str(o.cc),
        date: str(o.date),
        subject: str(o.subject),
        bodyMarkdown: str(o.bodyMarkdown),
        attachments: arr(o.attachments).map((a) => str(a)).filter(Boolean),
      };

    case "columns": {
      const cols = arr(o.columns).map((c) => kids(c));
      // Always land on 2 or 3 columns — a 1-column "columns" block is just a
      // stack, and beyond 3 nothing is readable on a laptop.
      while (cols.length < 2) cols.push([]);
      return {
        id,
        type: "columns",
        columns: cols.slice(0, 3),
        gap: oneOf(o.gap, ["sm", "md", "lg"] as const, "md"),
      };
    }

    case "accordion":
      return {
        id,
        type: "accordion",
        title: str(o.title),
        exclusive: bool(o.exclusive, false),
        items: arr(o.items).map((it) => {
          const i = rec(it);
          return {
            id: idOf(i.id),
            title: str(i.title),
            open: bool(i.open, false),
            blocks: kids(i.blocks),
          };
        }),
      };

    case "tabs":
      return {
        id,
        type: "tabs",
        items: arr(o.items).map((it) => {
          const i = rec(it);
          return {
            id: idOf(i.id),
            label: str(i.label),
            blocks: kids(i.blocks),
          };
        }),
      };

    case "card":
      return {
        id,
        type: "card",
        title: str(o.title),
        eyebrow: str(o.eyebrow),
        blocks: kids(o.blocks),
      };

    case "checklist":
      return {
        id,
        type: "checklist",
        title: str(o.title),
        items: arr(o.items).map((it) => {
          const i = rec(it);
          return { id: idOf(i.id), text: str(i.text) };
        }),
        required: bool(o.required, false),
      };

    case "knowledgeCheck":
      return {
        id,
        type: "knowledgeCheck",
        question: str(o.question),
        choices: arr(o.choices).map((c) => {
          const i = rec(c);
          return {
            id: idOf(i.id),
            text: str(i.text),
            correct: bool(i.correct, false),
          };
        }),
        explanation: str(o.explanation),
        required: bool(o.required, false),
        requireCorrect: bool(o.requireCorrect, false),
      };

    case "revealCard":
      return {
        id,
        type: "revealCard",
        front: str(o.front),
        backMarkdown: str(o.backMarkdown),
        required: bool(o.required, false),
      };

    case "scenario":
      return {
        id,
        type: "scenario",
        title: str(o.title),
        promptMarkdown: str(o.promptMarkdown),
        options: arr(o.options).map((c) => {
          const i = rec(c);
          return {
            id: idOf(i.id),
            text: str(i.text),
            outcomeMarkdown: str(i.outcomeMarkdown),
            correct: bool(i.correct, false),
          };
        }),
        required: bool(o.required, false),
        requireCorrect: bool(o.requireCorrect, false),
      };

    case "ordering":
      return {
        id,
        type: "ordering",
        title: str(o.title),
        promptMarkdown: str(o.promptMarkdown),
        items: arr(o.items).map((it) => {
          const i = rec(it);
          return { id: idOf(i.id), text: str(i.text) };
        }),
        required: bool(o.required, false),
      };

    case "html":
      return { id, type: "html", html: str(o.html) };

    default:
      return null;
  }
}

/**
 * Reject anything that is not a same-origin path or an https URL. Blocks are
 * admin-authored, but a `javascript:` href pasted from a bad source should not
 * survive into a learner's page.
 */
function safeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (s.startsWith("/")) return s;
  if (/^https:\/\//i.test(s)) return s;
  // Tolerate protocol-relative and bare http by upgrading rather than dropping.
  if (s.startsWith("//")) return "https:" + s;
  if (/^http:\/\//i.test(s)) return "https://" + s.slice(7);
  return "";
}

// ---------------------------------------------------------------------------
// Reading & writing a NOTES unit
// ---------------------------------------------------------------------------

export interface NotesDoc {
  version: 1;
  blocks: Block[];
}

/**
 * Read a NOTES unit's data blob.
 *
 * Units authored before the block builder stored `{ contentMarkdown, embedUrl,
 * embedHeight, embedTitle }`. Those are upgraded in memory to an equivalent
 * block list so they keep rendering; nothing is written back until the admin
 * saves, so this is safe to run on every read.
 */
export function readNotesDoc(data: Record<string, unknown>): NotesDoc {
  const raw = data.blocks;
  if (Array.isArray(raw)) {
    return { version: 1, blocks: parseBlocks(raw) };
  }
  return { version: 1, blocks: blocksFromLegacy(data) };
}

export function blocksFromLegacy(data: Record<string, unknown>): Block[] {
  const blocks: Block[] = [];

  const embedUrl = safeUrl(str(data.embedUrl));
  if (embedUrl) {
    blocks.push({
      id: newBlockId(),
      type: "embed",
      url: embedUrl,
      title: str(data.embedTitle),
      height: Math.max(0, int(data.embedHeight, 0)),
    });
  }

  const markdown = str(data.contentMarkdown);
  if (markdown.trim()) {
    blocks.push({ id: newBlockId(), type: "richText", markdown });
  }

  return blocks;
}

/** True when the unit still has no authored content of any kind. */
export function isEmptyDoc(doc: NotesDoc): boolean {
  return doc.blocks.length === 0;
}

// ---------------------------------------------------------------------------
// Block factories — used by the editor's "add block" palette
// ---------------------------------------------------------------------------

export function emptyBlock(type: BlockType): Block {
  const id = newBlockId();
  switch (type) {
    case "richText":
      return { id, type, markdown: "" };
    case "heading":
      return { id, type, level: 2, text: "Section heading", eyebrow: "" };
    case "callout":
      return { id, type, variant: "note", title: "", markdown: "" };
    case "quote":
      return { id, type, text: "", attribution: "" };
    case "table":
      return {
        id,
        type,
        markdown: "| Column | Column |\n| --- | --- |\n| Value | Value |",
        caption: "",
      };
    case "divider":
      return { id, type, label: "" };
    case "image":
      return { id, type, url: "", alt: "", caption: "", width: "normal" };
    case "video":
      return {
        id,
        type,
        provider: "youtube",
        videoId: "",
        libraryId: "",
        title: "",
        durationSec: 0,
      };
    case "pdf":
      return { id, type, url: "", title: "", height: 0, downloadable: true };
    case "embed":
      return { id, type, url: "", title: "", height: 0 };
    case "fileList":
      return {
        id,
        type,
        title: "Resources",
        items: [
          { id: newBlockId(), url: "", label: "", description: "", meta: "" },
        ],
      };
    case "email":
      return {
        id,
        type,
        from: "",
        to: "",
        cc: "",
        date: "",
        subject: "",
        bodyMarkdown: "",
        attachments: [],
      };
    case "columns":
      return { id, type, columns: [[], []], gap: "md" };
    case "accordion":
      return {
        id,
        type,
        title: "",
        exclusive: false,
        items: [
          { id: newBlockId(), title: "First panel", open: false, blocks: [] },
        ],
      };
    case "tabs":
      return {
        id,
        type,
        items: [{ id: newBlockId(), label: "Tab one", blocks: [] }],
      };
    case "card":
      return { id, type, title: "", eyebrow: "", blocks: [] };
    case "checklist":
      return {
        id,
        type,
        title: "",
        items: [{ id: newBlockId(), text: "" }],
        required: false,
      };
    case "knowledgeCheck":
      return {
        id,
        type,
        question: "",
        choices: [
          { id: newBlockId(), text: "", correct: true },
          { id: newBlockId(), text: "", correct: false },
        ],
        explanation: "",
        required: false,
        requireCorrect: false,
      };
    case "revealCard":
      return { id, type, front: "", backMarkdown: "", required: false };
    case "scenario":
      return {
        id,
        type,
        title: "",
        promptMarkdown: "",
        options: [
          { id: newBlockId(), text: "", outcomeMarkdown: "", correct: true },
          { id: newBlockId(), text: "", outcomeMarkdown: "", correct: false },
        ],
        required: false,
        requireCorrect: false,
      };
    case "ordering":
      return {
        id,
        type,
        title: "",
        promptMarkdown: "",
        items: [
          { id: newBlockId(), text: "" },
          { id: newBlockId(), text: "" },
          { id: newBlockId(), text: "" },
        ],
        required: false,
      };
    case "html":
      return { id, type, html: "" };
  }
}

// ---------------------------------------------------------------------------
// Tree operations — shared by every editor server action
// ---------------------------------------------------------------------------

/**
 * A block's position in the tree. Containers hold blocks in named slots
 * (`columns[1]`, `items[0].blocks`), so a plain index is not enough — a path is
 * the list of container ids walked to reach the list, plus the slot index.
 */
export interface BlockPath {
  /** Ids of the containers to walk into, outermost first. */
  containers: string[];
  /** For each container, which slot (column index / item index) to enter. */
  slots: number[];
}

/** Serialize a path for a hidden form field. `""` is the document root. */
export function encodePath(path: BlockPath): string {
  return path.containers.map((c, i) => `${c}:${path.slots[i] ?? 0}`).join("/");
}

export function decodePath(raw: string): BlockPath {
  const containers: string[] = [];
  const slots: number[] = [];
  for (const seg of String(raw || "").split("/")) {
    if (!seg) continue;
    const [c, s] = seg.split(":");
    if (!c) continue;
    containers.push(c);
    slots.push(Number(s) || 0);
  }
  return { containers, slots };
}

/**
 * Resolve a path to the block array it points at, returning a live reference
 * into `root` so callers can splice it. Returns null when the path is stale —
 * which happens naturally if two admins edit at once, and must not throw.
 */
export function resolveList(root: Block[], path: BlockPath): Block[] | null {
  let list = root;
  for (let i = 0; i < path.containers.length; i++) {
    const container = list.find((b) => b.id === path.containers[i]);
    if (!container) return null;
    const slot = path.slots[i] ?? 0;

    if (container.type === "columns") {
      const col = container.columns[slot];
      if (!col) return null;
      list = col;
    } else if (container.type === "accordion") {
      const item = container.items[slot];
      if (!item) return null;
      list = item.blocks;
    } else if (container.type === "tabs") {
      const item = container.items[slot];
      if (!item) return null;
      list = item.blocks;
    } else if (container.type === "card") {
      list = container.blocks;
    } else {
      return null;
    }
  }
  return list;
}

/** Insert at the end of the list a path points at. No-op on a stale path. */
export function insertBlock(root: Block[], path: BlockPath, block: Block): Block[] {
  const list = resolveList(root, path);
  if (list) list.push(block);
  return root;
}

export function removeBlock(root: Block[], path: BlockPath, id: string): Block[] {
  const list = resolveList(root, path);
  if (!list) return root;
  const i = list.findIndex((b) => b.id === id);
  if (i >= 0) list.splice(i, 1);
  return root;
}

export function moveBlockInList(
  root: Block[],
  path: BlockPath,
  id: string,
  dir: -1 | 1
): Block[] {
  const list = resolveList(root, path);
  if (!list) return root;
  const from = list.findIndex((b) => b.id === id);
  const to = from + dir;
  if (from === -1 || to < 0 || to >= list.length) return root;
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  return root;
}

/** Find a block anywhere in the tree, for targeted field updates. */
export function findBlock(root: Block[], id: string): Block | null {
  for (const b of root) {
    if (b.id === id) return b;
    const nested = childLists(b);
    for (const list of nested) {
      const hit = findBlock(list, id);
      if (hit) return hit;
    }
  }
  return null;
}

/** Every child block array a container holds, in render order. */
export function childLists(block: Block): Block[][] {
  switch (block.type) {
    case "columns":
      return block.columns;
    case "accordion":
      return block.items.map((i) => i.blocks);
    case "tabs":
      return block.items.map((i) => i.blocks);
    case "card":
      return [block.blocks];
    default:
      return [];
  }
}

/** Total block count including nested children — shown in the editor header. */
export function countBlocks(blocks: Block[]): number {
  let n = 0;
  for (const b of blocks) {
    n += 1;
    for (const list of childLists(b)) n += countBlocks(list);
  }
  return n;
}

/**
 * Strip the markdown syntax a one-line preview would otherwise show as noise.
 * Not a parser and not trying to be — this text is never rendered as HTML, it
 * only has to read cleanly in a collapsed editor header.
 */
function plain(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")       // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")    // links -> their text
    .replace(/```[\s\S]*?```/g, " ")            // fenced code
    .replace(/[#>*_`~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(text: string, max = 72): string {
  const t = plain(text);
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

/**
 * One line describing what a block actually contains, for the collapsed state
 * of the builder. A header reading "Rich text" twelve times is useless; the
 * author needs to recognise the block without opening it.
 *
 * Returns an empty string when there is nothing worth showing (a fresh block,
 * a divider with no label) so the caller can omit the line entirely rather
 * than print a placeholder.
 */
export function blockSummary(block: Block): string {
  const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

  switch (block.type) {
    case "richText":
      return clamp(block.markdown);
    case "heading":
      return clamp(block.text || block.eyebrow);
    case "callout":
      return clamp(block.title || block.markdown);
    case "quote":
      return clamp(block.text);
    case "table":
      return clamp(block.caption || block.markdown);
    case "divider":
      return clamp(block.label);
    case "image":
      return clamp(block.alt || block.caption || block.url);
    case "video":
      return clamp(block.title || block.videoId);
    case "pdf":
      return clamp(block.title || block.url);
    case "embed":
      return clamp(block.title || block.url);
    case "fileList":
      return clamp(block.title) || count(block.items.length, "file");
    case "email":
      return clamp(block.subject || block.from);
    case "columns":
      return count(block.columns.length, "column");
    case "accordion":
      return clamp(block.title) || count(block.items.length, "panel");
    case "tabs":
      return block.items.map((i) => i.label).filter(Boolean).join(" · ") ||
        count(block.items.length, "tab");
    case "card":
      return clamp(block.title || block.eyebrow);
    case "checklist":
      return clamp(block.title) || count(block.items.length, "item");
    case "knowledgeCheck":
      return clamp(block.question);
    case "revealCard":
      return clamp(block.front);
    case "scenario":
      return clamp(block.title || block.promptMarkdown);
    case "ordering":
      return clamp(block.title || block.promptMarkdown);
    case "html":
      return clamp(block.html);
  }
}

// ---------------------------------------------------------------------------
// Interactions — per-learner state recorded against a block
// ---------------------------------------------------------------------------

/**
 * What a learner's answer looks like for each interactive block type. Stored
 * verbatim in `BlockInteraction.payload`, so every field must survive a JSON
 * round trip.
 */
export interface InteractionPayload {
  /** checklist — ids of ticked items. */
  checked?: string[];
  /** knowledgeCheck — id of the chosen choice. */
  choiceId?: string;
  /** revealCard — whether the back has been shown. */
  revealed?: boolean;
  /** scenario — id of the chosen option. */
  optionId?: string;
  /** ordering — item ids in the learner's current arrangement. */
  order?: string[];
}

export function parseInteractionPayload(value: unknown): InteractionPayload {
  const o = rec(value);
  const out: InteractionPayload = {};
  if (Array.isArray(o.checked)) out.checked = o.checked.map((v) => str(v)).filter(Boolean);
  if (o.choiceId !== undefined) out.choiceId = str(o.choiceId);
  if (o.revealed !== undefined) out.revealed = bool(o.revealed, false);
  if (o.optionId !== undefined) out.optionId = str(o.optionId);
  if (Array.isArray(o.order)) out.order = o.order.map((v) => str(v)).filter(Boolean);
  return out;
}

/**
 * True when a block has enough authored content to actually render. An empty
 * checklist or a question with no choices renders nothing, so it must never
 * gate a learner out of completing the unit.
 */
export function isInteractiveRenderable(block: InteractiveBlock): boolean {
  switch (block.type) {
    case "checklist":
      return block.items.some((i) => i.text.trim());
    case "knowledgeCheck":
      return (
        !!block.question.trim() && block.choices.some((c) => c.text.trim())
      );
    case "revealCard":
      return !!block.front.trim();
    case "scenario":
      return (
        !!block.promptMarkdown.trim() &&
        block.options.some((o) => o.text.trim())
      );
    case "ordering":
      return block.items.filter((i) => i.text.trim()).length >= 2;
  }
}

/**
 * Decide whether an answer satisfies a block.
 *
 * This is deliberately pure and shared: the client calls it for instant
 * feedback, and the API route calls it again before writing `complete`, so a
 * crafted request cannot mark a required block done without a real answer.
 */
export function isInteractionComplete(
  block: InteractiveBlock,
  payload: InteractionPayload
): boolean {
  switch (block.type) {
    case "checklist": {
      const items = block.items.filter((i) => i.text.trim());
      if (!items.length) return true;
      const checked = new Set(payload.checked ?? []);
      return items.every((i) => checked.has(i.id));
    }

    case "knowledgeCheck": {
      const choice = block.choices.find((c) => c.id === payload.choiceId);
      if (!choice) return false;
      return block.requireCorrect ? choice.correct : true;
    }

    case "revealCard":
      return payload.revealed === true;

    case "scenario": {
      const option = block.options.find((o) => o.id === payload.optionId);
      if (!option) return false;
      return block.requireCorrect ? option.correct : true;
    }

    case "ordering": {
      // The authored sequence is the answer key.
      const key = block.items.filter((i) => i.text.trim()).map((i) => i.id);
      if (key.length < 2) return true;
      const got = payload.order ?? [];
      return (
        got.length === key.length && key.every((id, i) => got[i] === id)
      );
    }
  }
}

export interface InteractiveRef {
  block: InteractiveBlock;
  /** True when this block blocks unit completion until satisfied. */
  required: boolean;
}

/**
 * Every interactive block in the tree, in render order. Non-renderable blocks
 * are skipped entirely so half-authored content never traps a learner.
 */
export function collectInteractive(blocks: Block[]): InteractiveRef[] {
  const out: InteractiveRef[] = [];
  const walk = (list: Block[]) => {
    for (const b of list) {
      if (isInteractive(b) && isInteractiveRenderable(b)) {
        out.push({ block: b, required: b.required });
      }
      for (const child of childLists(b)) walk(child);
    }
  };
  walk(blocks);
  return out;
}

/** Ids of the blocks that must be satisfied before the unit can be completed. */
export function requiredBlockIds(blocks: Block[]): string[] {
  return collectInteractive(blocks)
    .filter((r) => r.required)
    .map((r) => r.block.id);
}
