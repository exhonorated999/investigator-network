import {
  type Block,
  type BlockPath,
  BLOCK_CATALOG,
  BLOCK_GROUPS,
  BLOCK_LABEL,
  countBlocks,
  encodePath,
} from "@/lib/blocks";
import {
  addNoteBlock,
  addNoteItem,
  deleteNoteBlock,
  deleteNoteItem,
  duplicateNoteBlock,
  moveNoteBlock,
  setNoteEmbed,
  setNoteVideo,
  updateNoteBlock,
  uploadNoteAsset,
} from "@/app/admin/courses/notes-actions";
import { NotesJsonPanel } from "./notes-json-panel";

/**
 * Admin block builder for NOTES units.
 *
 * Server-rendered on purpose. Every mutation is a plain `<form>` posting to a
 * server action, which means the builder works without hydration, survives a
 * mid-edit refresh, and needs no client-side copy of the document. The cost is
 * a round trip per edit; for authoring (as opposed to typing) that trade is
 * worth it, and it keeps the block tree single-sourced in the database.
 *
 * Forms cannot nest, so the layout is deliberate: a block's structural
 * controls, its own field form, and its children's editors are all SIBLINGS,
 * never parents of one another.
 */

const ROOT: BlockPath = { containers: [], slots: [] };

interface Ctx {
  unitId: string;
  courseId: string;
}

function childPath(path: BlockPath, blockId: string, slot: number): BlockPath {
  return {
    containers: [...path.containers, blockId],
    slots: [...path.slots, slot],
  };
}

export function NotesBuilder({
  unitId,
  courseId,
  blocks,
}: {
  unitId: string;
  courseId: string;
  blocks: Block[];
}) {
  const ctx: Ctx = { unitId, courseId };
  const total = countBlocks(blocks);

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="eyebrow eyebrow-gold">03 / Course notes</p>
        <span className="font-mono text-[11px] text-muted">
          {total} block{total === 1 ? "" : "s"}
        </span>
      </div>

      <p className="mt-2 max-w-[68ch] text-sm text-muted">
        Build the page a learner reads. Blocks stack top to bottom; layout
        blocks (columns, accordion, tabs, card) hold other blocks inside them.
      </p>

      <BlockEditorList ctx={ctx} blocks={blocks} path={ROOT} depth={0} />

      <NotesJsonPanel unitId={unitId} courseId={courseId} blocks={blocks} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Recursive list
// ---------------------------------------------------------------------------

function BlockEditorList({
  ctx,
  blocks,
  path,
  depth,
  label,
}: {
  ctx: Ctx;
  blocks: Block[];
  path: BlockPath;
  depth: number;
  label?: string;
}) {
  return (
    <div className="mt-4 grid gap-3">
      {label ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          {label}
        </p>
      ) : null}

      {blocks.map((block, i) => (
        <BlockEditor
          key={block.id}
          ctx={ctx}
          block={block}
          path={path}
          index={i}
          count={blocks.length}
          depth={depth}
        />
      ))}

      {blocks.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          Empty. Add a block below.
        </p>
      ) : null}

      <AddBlock ctx={ctx} path={path} compact={depth > 0} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add-block palette
// ---------------------------------------------------------------------------

function AddBlock({
  ctx,
  path,
  compact,
}: {
  ctx: Ctx;
  path: BlockPath;
  compact: boolean;
}) {
  const encoded = encodePath(path);
  return (
    <details className="group border border-border bg-[rgba(10,12,17,0.4)]">
      <summary className="cursor-pointer list-none px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent transition hover:text-accent-bright">
        + Add block
      </summary>
      <div className="border-t border-border p-3">
        {BLOCK_GROUPS.map((group) => {
          const items = BLOCK_CATALOG.filter((b) => b.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-4 last:mb-0">
              <p className="eyebrow eyebrow-muted">{group}</p>
              <div
                className={`mt-2 grid gap-2 ${
                  compact
                    ? "grid-cols-2 sm:grid-cols-3"
                    : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                }`}
              >
                {items.map((meta) => (
                  <form key={meta.type} action={addNoteBlock}>
                    <input type="hidden" name="unitId" value={ctx.unitId} />
                    <input type="hidden" name="courseId" value={ctx.courseId} />
                    <input type="hidden" name="path" value={encoded} />
                    <input type="hidden" name="type" value={meta.type} />
                    <button
                      className="w-full border border-border bg-[rgba(10,12,17,0.6)] px-3 py-2 text-left transition hover:border-accent hover:bg-[rgba(0,180,216,0.06)]"
                      title={meta.description}
                    >
                      <span className="font-mono text-[11px] text-accent">
                        {meta.icon}
                      </span>{" "}
                      <span className="text-[13px] text-foreground">
                        {meta.label}
                      </span>
                    </button>
                  </form>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// One block
// ---------------------------------------------------------------------------

function BlockEditor({
  ctx,
  block,
  path,
  index,
  count,
  depth,
}: {
  ctx: Ctx;
  block: Block;
  path: BlockPath;
  index: number;
  count: number;
  depth: number;
}) {
  const encoded = encodePath(path);
  const hidden = (
    <>
      <input type="hidden" name="unitId" value={ctx.unitId} />
      <input type="hidden" name="courseId" value={ctx.courseId} />
      <input type="hidden" name="path" value={encoded} />
      <input type="hidden" name="blockId" value={block.id} />
    </>
  );

  return (
    <div className="border border-border bg-[rgba(10,12,17,0.55)]">
      {/* Structural controls — siblings of the field form, never parents. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent-bright">
          {BLOCK_LABEL[block.type]}
        </span>
        <span className="font-mono text-[10px] text-muted">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="flex-1" />

        <form action={moveNoteBlock}>
          {hidden}
          <input type="hidden" name="dir" value="up" />
          <button
            className="btn btn-ghost btn-sm px-2 disabled:opacity-25"
            disabled={index === 0}
            title="Move up"
          >
            ↑
          </button>
        </form>
        <form action={moveNoteBlock}>
          {hidden}
          <input type="hidden" name="dir" value="down" />
          <button
            className="btn btn-ghost btn-sm px-2 disabled:opacity-25"
            disabled={index === count - 1}
            title="Move down"
          >
            ↓
          </button>
        </form>
        <form action={duplicateNoteBlock}>
          {hidden}
          <button className="btn btn-ghost btn-sm px-2" title="Duplicate">
            ⧉
          </button>
        </form>
        <form action={deleteNoteBlock}>
          {hidden}
          <button
            className="btn btn-ghost btn-sm px-2 border-danger/40 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)] hover:text-danger"
            title="Delete block"
          >
            ✕
          </button>
        </form>
      </div>

      <div className="p-3">
        <BlockFields ctx={ctx} block={block} />
        <BlockChildren ctx={ctx} block={block} path={path} depth={depth} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small field primitives
// ---------------------------------------------------------------------------

function Text({
  name,
  label,
  value,
  placeholder,
}: {
  name: string;
  label: string;
  value: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="eyebrow eyebrow-muted">{label}</span>
      <input
        name={`f_${name}`}
        defaultValue={value}
        placeholder={placeholder}
        className="field"
      />
    </label>
  );
}

function Area({
  name,
  label,
  value,
  rows = 6,
  placeholder,
  mono,
}: {
  name: string;
  label: string;
  value: string;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="eyebrow eyebrow-muted">{label}</span>
      <textarea
        name={`f_${name}`}
        defaultValue={value}
        rows={rows}
        placeholder={placeholder}
        className={mono ? "field font-mono text-[13px]" : "field"}
      />
    </label>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="grid gap-1.5">
      <span className="eyebrow eyebrow-muted">{label}</span>
      <select name={`f_${name}`} defaultValue={value} className="field">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Checkbox. The hidden "false" ahead of it means an unticked box still sends a
 * value — `updateNoteBlock` takes the last value for a key, so ticked wins.
 */
function Check({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: boolean;
}) {
  return (
    <label className="flex items-center gap-2 py-1">
      <input type="hidden" name={`f_${name}`} value="false" />
      <input
        type="checkbox"
        name={`f_${name}`}
        value="true"
        defaultChecked={value}
        className="h-4 w-4 accent-[var(--accent)]"
      />
      <span className="text-[13px] text-foreground">{label}</span>
    </label>
  );
}

/**
 * Divider above the completion-gating controls. These change whether a learner
 * can finish the unit, so they are visually separated from the content fields.
 */
function RequiredNote() {
  return (
    <div className="mt-1 border-t border-border pt-3">
      <span className="eyebrow eyebrow-muted">Completion gating</span>
    </div>
  );
}

function SaveRow() {  return (
    <div className="mt-1">
      <button className="btn btn-primary btn-sm">Save block</button>
    </div>
  );
}

/** Upload control for a block asset. A sibling form — never nested. */
function AssetUpload({
  ctx,
  blockId,
  field,
  index,
  accept,
  label,
}: {
  ctx: Ctx;
  blockId: string;
  field: string;
  index?: number;
  accept: string;
  label: string;
}) {
  return (
    <form action={uploadNoteAsset} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="unitId" value={ctx.unitId} />
      <input type="hidden" name="courseId" value={ctx.courseId} />
      <input type="hidden" name="blockId" value={blockId} />
      <input type="hidden" name="field" value={field} />
      {index != null ? (
        <input type="hidden" name="index" value={index} />
      ) : null}
      <input
        type="file"
        name="file"
        accept={accept}
        required
        className="field w-auto flex-1 file:mr-3 file:border-0 file:bg-transparent file:font-mono file:text-[11px] file:uppercase file:tracking-[0.14em] file:text-accent"
      />
      <button className="btn btn-ghost btn-sm">{label}</button>
    </form>
  );
}

function ItemHeader({
  ctx,
  blockId,
  index,
  title,
}: {
  ctx: Ctx;
  blockId: string;
  index: number;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        {title} {String(index + 1).padStart(2, "0")}
      </span>
      <span className="flex-1" />
      <form action={deleteNoteItem}>
        <input type="hidden" name="unitId" value={ctx.unitId} />
        <input type="hidden" name="courseId" value={ctx.courseId} />
        <input type="hidden" name="blockId" value={blockId} />
        <input type="hidden" name="index" value={index} />
        <button
          className="btn btn-ghost btn-sm px-2 border-danger/40 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)] hover:text-danger"
          title="Remove"
        >
          ✕
        </button>
      </form>
    </div>
  );
}

function AddItem({
  ctx,
  blockId,
  label,
}: {
  ctx: Ctx;
  blockId: string;
  label: string;
}) {
  return (
    <form action={addNoteItem} className="mt-3">
      <input type="hidden" name="unitId" value={ctx.unitId} />
      <input type="hidden" name="courseId" value={ctx.courseId} />
      <input type="hidden" name="blockId" value={blockId} />
      <button className="btn btn-ghost btn-sm">+ {label}</button>
    </form>
  );
}

/** Wraps a block's scalar fields in their own form. */
function Fields({
  ctx,
  blockId,
  children,
}: {
  ctx: Ctx;
  blockId: string;
  children: React.ReactNode;
}) {
  return (
    <form action={updateNoteBlock} className="grid gap-3">
      <input type="hidden" name="unitId" value={ctx.unitId} />
      <input type="hidden" name="courseId" value={ctx.courseId} />
      <input type="hidden" name="blockId" value={blockId} />
      {children}
      <SaveRow />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Per-type field sets
// ---------------------------------------------------------------------------

function BlockFields({ ctx, block }: { ctx: Ctx; block: Block }) {
  switch (block.type) {
    case "richText":
      return (
        <Fields ctx={ctx} blockId={block.id}>
          <Area
            name="markdown"
            label="Markdown"
            value={block.markdown}
            rows={10}
            placeholder="## Heading&#10;&#10;Body text, **bold**, [links](https://…), lists…"
          />
        </Fields>
      );

    case "heading":
      return (
        <Fields ctx={ctx} blockId={block.id}>
          <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
            <Select
              name="level"
              label="Level"
              value={String(block.level)}
              options={[
                { value: "2", label: "H2" },
                { value: "3", label: "H3" },
                { value: "4", label: "H4" },
              ]}
            />
            <Text name="text" label="Text" value={block.text} />
          </div>
          <Text
            name="eyebrow"
            label="Kicker (optional)"
            value={block.eyebrow}
            placeholder="01 / BACKGROUND"
          />
        </Fields>
      );

    case "callout":
      return (
        <Fields ctx={ctx} blockId={block.id}>
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
            <Select
              name="variant"
              label="Variant"
              value={block.variant}
              options={[
                { value: "note", label: "Note" },
                { value: "warning", label: "Warning" },
                { value: "critical", label: "Critical" },
                { value: "success", label: "Success" },
                { value: "evidence", label: "Evidence" },
              ]}
            />
            <Text name="title" label="Title (optional)" value={block.title} />
          </div>
          <Area name="markdown" label="Body" value={block.markdown} rows={4} />
        </Fields>
      );

    case "quote":
      return (
        <Fields ctx={ctx} blockId={block.id}>
          <Area name="text" label="Quote" value={block.text} rows={3} />
          <Text
            name="attribution"
            label="Attribution"
            value={block.attribution}
          />
        </Fields>
      );

    case "table":
      return (
        <Fields ctx={ctx} blockId={block.id}>
          <Area
            name="markdown"
            label="Markdown table"
            value={block.markdown}
            rows={7}
            mono
          />
          <Text name="caption" label="Caption (optional)" value={block.caption} />
        </Fields>
      );

    case "divider":
      return (
        <Fields ctx={ctx} blockId={block.id}>
          <Text name="label" label="Label (optional)" value={block.label} />
        </Fields>
      );

    case "image":
      return (
        <>
          <AssetUpload
            ctx={ctx}
            blockId={block.id}
            field="url"
            accept="image/*"
            label="Upload image"
          />
          <div className="mt-3">
            <Fields ctx={ctx} blockId={block.id}>
              <Text
                name="url"
                label="Image URL"
                value={block.url}
                placeholder="https://… or upload above"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Text name="alt" label="Alt text" value={block.alt} />
                <Select
                  name="width"
                  label="Width"
                  value={block.width}
                  options={[
                    { value: "normal", label: "Normal" },
                    { value: "wide", label: "Wide" },
                    { value: "full", label: "Full bleed" },
                  ]}
                />
              </div>
              <Text name="caption" label="Caption" value={block.caption} />
            </Fields>
          </div>
        </>
      );

    case "video":
      return (
        <>
          <form
            action={setNoteVideo}
            className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
          >
            <input type="hidden" name="unitId" value={ctx.unitId} />
            <input type="hidden" name="courseId" value={ctx.courseId} />
            <input type="hidden" name="blockId" value={block.id} />
            <label className="grid gap-1.5">
              <span className="eyebrow eyebrow-muted">Source</span>
              <select
                name="provider"
                defaultValue={block.provider}
                className="field"
              >
                <option value="youtube">YouTube</option>
                <option value="bunny">Bunny Stream</option>
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="eyebrow eyebrow-muted">
                Paste a link, embed code, or id
              </span>
              <input
                name="raw"
                placeholder="https://youtu.be/… or an <iframe> snippet"
                className="field"
              />
            </label>
            <button className="btn btn-ghost btn-sm">Set video</button>
          </form>

          {block.videoId ? (
            <p className="mt-2 font-mono text-[11px] text-muted">
              {block.provider} · {block.videoId}
              {block.libraryId ? ` · lib ${block.libraryId}` : ""}
            </p>
          ) : (
            <p className="mt-2 font-mono text-[11px] text-gold">
              No video set yet.
            </p>
          )}

          <div className="mt-3">
            <Fields ctx={ctx} blockId={block.id}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Text name="title" label="Title" value={block.title} />
                <Text
                  name="durationSec"
                  label="Duration (seconds)"
                  value={String(block.durationSec || "")}
                />
              </div>
            </Fields>
          </div>
        </>
      );

    case "pdf":
      return (
        <>
          <AssetUpload
            ctx={ctx}
            blockId={block.id}
            field="url"
            accept="application/pdf,.pdf"
            label="Upload PDF"
          />
          <div className="mt-3">
            <Fields ctx={ctx} blockId={block.id}>
              <Text
                name="url"
                label="PDF URL"
                value={block.url}
                placeholder="https://… or upload above"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Text name="title" label="Title" value={block.title} />
                <Text
                  name="height"
                  label="Viewer height (px, 0 = auto)"
                  value={String(block.height || "")}
                />
              </div>
              <Check
                name="downloadable"
                label="Show a download button"
                value={block.downloadable}
              />
            </Fields>
          </div>
        </>
      );

    case "embed":
      return (
        <>
          <form action={setNoteEmbed} className="grid gap-2">
            <input type="hidden" name="unitId" value={ctx.unitId} />
            <input type="hidden" name="courseId" value={ctx.courseId} />
            <input type="hidden" name="blockId" value={block.id} />
            <label className="grid gap-1.5">
              <span className="eyebrow eyebrow-muted">
                Paste embed code or share link
              </span>
              <textarea
                name="raw"
                rows={3}
                placeholder="Heyzine, Issuu, Google Slides, Canva, PowerPoint… paste the whole <iframe> if you like"
                className="field font-mono text-[13px]"
              />
            </label>
            <div>
              <button className="btn btn-ghost btn-sm">Set embed</button>
            </div>
          </form>

          {block.url ? (
            <p className="mt-2 break-all font-mono text-[11px] text-muted">
              {block.url}
            </p>
          ) : (
            <p className="mt-2 font-mono text-[11px] text-gold">
              No embed set yet.
            </p>
          )}

          <div className="mt-3">
            <Fields ctx={ctx} blockId={block.id}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Text name="title" label="Title" value={block.title} />
                <Text
                  name="height"
                  label="Height (px, 0 = auto)"
                  value={String(block.height || "")}
                />
              </div>
            </Fields>
          </div>
        </>
      );

    case "fileList":
      return (
        <>
          <Fields ctx={ctx} blockId={block.id}>
            <Text name="title" label="Section title" value={block.title} />
            {block.items.map((item, i) => (
              <div key={item.id} className="border border-border p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  File {String(i + 1).padStart(2, "0")}
                </p>
                <div className="mt-2 grid gap-3">
                  <Text
                    name={`items.${i}.label`}
                    label="Label"
                    value={item.label}
                  />
                  <Text name={`items.${i}.url`} label="URL" value={item.url} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Text
                      name={`items.${i}.description`}
                      label="Description"
                      value={item.description}
                    />
                    <Text
                      name={`items.${i}.meta`}
                      label="Meta"
                      value={item.meta}
                      placeholder="PDF · 2.4 MB"
                    />
                  </div>
                </div>
              </div>
            ))}
          </Fields>

          {/* Uploads and removals are separate forms — they cannot nest. */}
          <div className="mt-3 grid gap-2">
            {block.items.map((item, i) => (
              <div
                key={item.id}
                className="border border-dashed border-border p-2"
              >
                <ItemHeader
                  ctx={ctx}
                  blockId={block.id}
                  index={i}
                  title="File"
                />
                <div className="mt-2">
                  <AssetUpload
                    ctx={ctx}
                    blockId={block.id}
                    field="url"
                    index={i}
                    accept="*/*"
                    label="Upload"
                  />
                </div>
              </div>
            ))}
          </div>
          <AddItem ctx={ctx} blockId={block.id} label="Add file" />
        </>
      );

    case "email":
      return (
        <Fields ctx={ctx} blockId={block.id}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Text name="from" label="From" value={block.from} />
            <Text name="to" label="To" value={block.to} />
            <Text name="cc" label="Cc" value={block.cc} />
            <Text
              name="date"
              label="Date"
              value={block.date}
              placeholder="12 Mar 2026, 09:41"
            />
          </div>
          <Text name="subject" label="Subject" value={block.subject} />
          <Area
            name="bodyMarkdown"
            label="Body"
            value={block.bodyMarkdown}
            rows={8}
          />
          <Area
            name="attachments"
            label="Attachments (one per line)"
            value={block.attachments.join("\n")}
            rows={3}
            mono
          />
        </Fields>
      );

    case "columns":
      return (
        <Fields ctx={ctx} blockId={block.id}>
          <Select
            name="gap"
            label="Gap"
            value={block.gap}
            options={[
              { value: "sm", label: "Tight" },
              { value: "md", label: "Normal" },
              { value: "lg", label: "Wide" },
            ]}
          />
        </Fields>
      );

    case "accordion":
      return (
        <Fields ctx={ctx} blockId={block.id}>
          <Text name="title" label="Section title" value={block.title} />
          <Check
            name="exclusive"
            label="Only one panel open at a time"
            value={block.exclusive}
          />
        </Fields>
      );

    case "tabs":
      return null;

    case "card":
      return (
        <Fields ctx={ctx} blockId={block.id}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Text name="eyebrow" label="Kicker" value={block.eyebrow} />
            <Text name="title" label="Title" value={block.title} />
          </div>
        </Fields>
      );

    case "checklist":
      return (
        <>
          <Fields ctx={ctx} blockId={block.id}>
            <Text name="title" label="Title" value={block.title} />
            {block.items.map((item, i) => (
              <Text
                key={item.id}
                name={`items.${i}.text`}
                label={`Item ${i + 1}`}
                value={item.text}
              />
            ))}
            <RequiredNote />
            <Check
              name="required"
              label="Required — every item must be ticked before the unit can be completed"
              value={block.required}
            />
          </Fields>
          <div className="mt-3 grid gap-2">
            {block.items.map((item, i) => (
              <ItemHeader
                key={item.id}
                ctx={ctx}
                blockId={block.id}
                index={i}
                title="Item"
              />
            ))}
          </div>
          <AddItem ctx={ctx} blockId={block.id} label="Add item" />
        </>
      );

    case "knowledgeCheck":
      return (
        <>
          <Fields ctx={ctx} blockId={block.id}>
            <Area name="question" label="Question" value={block.question} rows={2} />
            {block.choices.map((choice, i) => (
              <div
                key={choice.id}
                className="grid gap-2 border border-border p-3 sm:grid-cols-[1fr_auto] sm:items-end"
              >
                <Text
                  name={`choices.${i}.text`}
                  label={`Choice ${i + 1}`}
                  value={choice.text}
                />
                <Check
                  name={`choices.${i}.correct`}
                  label="Correct"
                  value={choice.correct}
                />
              </div>
            ))}
            <Area
              name="explanation"
              label="Explanation shown after answering"
              value={block.explanation}
              rows={3}
            />
            <RequiredNote />
            <Check
              name="required"
              label="Required — must be answered before the unit can be completed"
              value={block.required}
            />
            <Check
              name="requireCorrect"
              label="…and the answer must be correct"
              value={block.requireCorrect}
            />
          </Fields>
          <div className="mt-3 grid gap-2">
            {block.choices.map((choice, i) => (
              <ItemHeader
                key={choice.id}
                ctx={ctx}
                blockId={block.id}
                index={i}
                title="Choice"
              />
            ))}
          </div>
          <AddItem ctx={ctx} blockId={block.id} label="Add choice" />
        </>
      );

    case "revealCard":
      return (
        <Fields ctx={ctx} blockId={block.id}>
          <Text name="front" label="Front (the prompt)" value={block.front} />
          <Area
            name="backMarkdown"
            label="Back (revealed)"
            value={block.backMarkdown}
            rows={4}
          />
          <RequiredNote />
          <Check
            name="required"
            label="Required — must be revealed before the unit can be completed"
            value={block.required}
          />
        </Fields>
      );

    case "scenario":
      return (
        <>
          <Fields ctx={ctx} blockId={block.id}>
            <Text name="title" label="Title" value={block.title} />
            <Area
              name="promptMarkdown"
              label="The situation (markdown)"
              value={block.promptMarkdown}
              rows={5}
              placeholder="You arrive at the address and the door is ajar…"
            />
            {block.options.map((option, i) => (
              <div
                key={option.id}
                className="grid gap-2 border border-border p-3"
              >
                <Text
                  name={`options.${i}.text`}
                  label={`Option ${String.fromCharCode(65 + i)}`}
                  value={option.text}
                />
                <Area
                  name={`options.${i}.outcomeMarkdown`}
                  label="Consequence shown when chosen"
                  value={option.outcomeMarkdown}
                  rows={3}
                />
                <Check
                  name={`options.${i}.correct`}
                  label="This is a defensible course of action"
                  value={option.correct}
                />
              </div>
            ))}
            <RequiredNote />
            <Check
              name="required"
              label="Required — a decision must be made before the unit can be completed"
              value={block.required}
            />
            <Check
              name="requireCorrect"
              label="…and it must be a defensible one (leave off for open judgement calls)"
              value={block.requireCorrect}
            />
          </Fields>
          <div className="mt-3 grid gap-2">
            {block.options.map((option, i) => (
              <ItemHeader
                key={option.id}
                ctx={ctx}
                blockId={block.id}
                index={i}
                title="Option"
              />
            ))}
          </div>
          <AddItem ctx={ctx} blockId={block.id} label="Add option" />
        </>
      );

    case "ordering":
      return (
        <>
          <Fields ctx={ctx} blockId={block.id}>
            <Text name="title" label="Title" value={block.title} />
            <Area
              name="promptMarkdown"
              label="Instructions (markdown)"
              value={block.promptMarkdown}
              rows={3}
              placeholder="Arrange these steps into the correct sequence."
            />
            <p className="text-xs text-muted">
              Enter the steps in the <strong>correct</strong> order. Learners see
              them shuffled.
            </p>
            {block.items.map((item, i) => (
              <Text
                key={item.id}
                name={`items.${i}.text`}
                label={`Step ${i + 1}`}
                value={item.text}
              />
            ))}
            <RequiredNote />
            <Check
              name="required"
              label="Required — the correct order must be reached before the unit can be completed"
              value={block.required}
            />
          </Fields>
          <div className="mt-3 grid gap-2">
            {block.items.map((item, i) => (
              <ItemHeader
                key={item.id}
                ctx={ctx}
                blockId={block.id}
                index={i}
                title="Step"
              />
            ))}
          </div>
          <AddItem ctx={ctx} blockId={block.id} label="Add step" />
        </>
      );

    case "html":
      return (
        <Fields ctx={ctx} blockId={block.id}>
          <Area
            name="html"
            label="Raw HTML (sanitized on render)"
            value={block.html}
            rows={8}
            mono
          />
        </Fields>
      );
  }
}

// ---------------------------------------------------------------------------
// Container children
// ---------------------------------------------------------------------------

function BlockChildren({
  ctx,
  block,
  path,
  depth,
}: {
  ctx: Ctx;
  block: Block;
  path: BlockPath;
  depth: number;
}) {
  if (block.type === "columns") {
    return (
      <div className="mt-4 grid gap-3 border-t border-border pt-3">
        {block.columns.map((col, i) => (
          <div key={i} className="border border-dashed border-border p-3">
            <ItemHeader
              ctx={ctx}
              blockId={block.id}
              index={i}
              title="Column"
            />
            <BlockEditorList
              ctx={ctx}
              blocks={col}
              path={childPath(path, block.id, i)}
              depth={depth + 1}
            />
          </div>
        ))}
        {block.columns.length < 3 ? (
          <AddItem ctx={ctx} blockId={block.id} label="Add column" />
        ) : null}
      </div>
    );
  }

  if (block.type === "accordion") {
    return (
      <div className="mt-4 grid gap-3 border-t border-border pt-3">
        {block.items.map((item, i) => (
          <div key={item.id} className="border border-dashed border-border p-3">
            <ItemHeader ctx={ctx} blockId={block.id} index={i} title="Panel" />
            <form action={updateNoteBlock} className="mt-2 grid gap-2">
              <input type="hidden" name="unitId" value={ctx.unitId} />
              <input type="hidden" name="courseId" value={ctx.courseId} />
              <input type="hidden" name="blockId" value={block.id} />
              <Text
                name={`items.${i}.title`}
                label="Panel title"
                value={item.title}
              />
              <Check
                name={`items.${i}.open`}
                label="Open by default"
                value={item.open}
              />
              <div>
                <button className="btn btn-ghost btn-sm">Save panel</button>
              </div>
            </form>
            <BlockEditorList
              ctx={ctx}
              blocks={item.blocks}
              path={childPath(path, block.id, i)}
              depth={depth + 1}
              label="Panel contents"
            />
          </div>
        ))}
        <AddItem ctx={ctx} blockId={block.id} label="Add panel" />
      </div>
    );
  }

  if (block.type === "tabs") {
    return (
      <div className="mt-4 grid gap-3 border-t border-border pt-3">
        {block.items.map((item, i) => (
          <div key={item.id} className="border border-dashed border-border p-3">
            <ItemHeader ctx={ctx} blockId={block.id} index={i} title="Tab" />
            <form action={updateNoteBlock} className="mt-2 grid gap-2">
              <input type="hidden" name="unitId" value={ctx.unitId} />
              <input type="hidden" name="courseId" value={ctx.courseId} />
              <input type="hidden" name="blockId" value={block.id} />
              <Text
                name={`items.${i}.label`}
                label="Tab label"
                value={item.label}
              />
              <div>
                <button className="btn btn-ghost btn-sm">Save tab</button>
              </div>
            </form>
            <BlockEditorList
              ctx={ctx}
              blocks={item.blocks}
              path={childPath(path, block.id, i)}
              depth={depth + 1}
              label="Tab contents"
            />
          </div>
        ))}
        <AddItem ctx={ctx} blockId={block.id} label="Add tab" />
      </div>
    );
  }

  if (block.type === "card") {
    return (
      <div className="mt-4 border-t border-border pt-3">
        <BlockEditorList
          ctx={ctx}
          blocks={block.blocks}
          path={childPath(path, block.id, 0)}
          depth={depth + 1}
          label="Card contents"
        />
      </div>
    );
  }

  return null;
}
