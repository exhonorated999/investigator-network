"use client";

import type {
  EmailBlock,
  EmbedBlock,
  FileListBlock,
  FileListItem,
  ImageBlock,
  MediaWidth,
  PdfBlock,
  VideoBlock,
} from "@/lib/blocks";
import { newBlockId } from "@/lib/blocks";
import { PROSE_INLINE } from "@/components/blocks/prose";
import { useEditor } from "./editor-store";
import { InlineMarkdown, InlineText } from "./inline-fields";
import {
  AddItemButton,
  AssetUpload,
  ItemControls,
  NoProps,
  PasteNormalize,
  PropGroup,
  PropNumber,
  PropSelect,
  PropText,
  PropToggle,
} from "./fields";

/**
 * Editable surfaces for the media block types.
 *
 * Follows the four rules established in editable-content.tsx:
 *
 *  1. Each `Edit*` component mirrors its counterpart in
 *     `src/components/blocks/media.tsx`, with reader-facing strings swapped for
 *     `InlineText` / `InlineMarkdown` carrying the SAME typography classes.
 *  2. Empty values render a placeholder instead of collapsing to nothing.
 *  3. Structural settings never appear on the canvas; they go in the matching
 *     `*Props` component for the properties rail.
 *  4. Mutations go through `patch(block.id, { … })` from the editor store.
 *     Never mutate a block object in place — undo depends on old trees staying
 *     untouched.
 *
 * One extra rule specific to this group: live players and third-party iframes
 * are never embedded on the canvas. A YouTube iframe steals focus and
 * autoplays; a third-party embed can navigate the editor frame. Both are
 * replaced with static placeholder panels that show the same metadata the
 * learner would see.
 */

// ---------------------------------------------------------------------------
// image
// ---------------------------------------------------------------------------

const WIDTH_CLASS: Record<MediaWidth, string> = {
  normal: "max-w-2xl",
  wide: "max-w-5xl",
  full: "w-full",
};

export function EditImage({ block }: { block: ImageBlock }) {
  const { patch } = useEditor();
  const url = block.url.trim();
  const widthClass = WIDTH_CLASS[block.width] ?? WIDTH_CLASS.normal;

  return (
    <figure className={widthClass}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={block.alt.trim() || block.caption.trim() || ""}
          className="w-full border border-border"
          loading="lazy"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center border border-dashed border-border bg-well-soft text-sm text-muted">
          No image URL yet
        </div>
      )}
      <figcaption className="mt-2">
        <InlineText
          value={block.caption}
          onChange={(caption) => patch(block.id, { caption })}
          placeholder="Caption (optional)"
          ariaLabel="Image caption"
          className="block font-mono text-xs uppercase tracking-[0.14em] text-muted"
        />
      </figcaption>
    </figure>
  );
}

function ImageProps({ block }: { block: ImageBlock }) {
  const { patch } = useEditor();
  return (
    <PropGroup label="Image">
      <AssetUpload
        label="Upload an image"
        accept="image/*"
        onUploaded={(a) =>
          // Seed alt from the filename only when it is still blank, so an
          // upload never overwrites alt text the author wrote deliberately.
          patch(block.id, {
            url: a.url,
            ...(block.alt.trim() ? {} : { alt: a.filename }),
          })
        }
      />
      <PropText
        label="URL"
        value={block.url}
        onChange={(url) => patch(block.id, { url })}
        placeholder="/api/files/… or https://…"
      />
      <PropText
        label="Alt text"
        value={block.alt}
        onChange={(alt) => patch(block.id, { alt })}
        placeholder="Describe the image for screen readers"
        hint="Accessibility metadata — not shown as visible text."
      />
      <PropSelect<MediaWidth>
        label="Width"
        value={block.width}
        onChange={(width) => patch(block.id, { width })}
        options={[
          { value: "normal", label: "Normal" },
          { value: "wide", label: "Wide" },
          { value: "full", label: "Full" },
        ]}
      />
    </PropGroup>
  );
}

// ---------------------------------------------------------------------------
// video
// ---------------------------------------------------------------------------

export function EditVideo({ block }: { block: VideoBlock }) {
  const { patch } = useEditor();
  const videoId = block.videoId.trim();
  return (
    <div className="panel rule-top overflow-hidden">
      {/* 16:9 placeholder — never a live player on the canvas. */}
      <div className="relative flex aspect-video w-full items-center justify-center bg-well-strong">
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {block.provider === "youtube" ? "YouTube" : "Bunny Stream"} · Video
          </p>
          <p className="mt-1 font-mono text-sm text-accent">
            {videoId || "No video id yet"}
          </p>
        </div>
      </div>
      <div className="px-5 py-3">
        <InlineText
          value={block.title}
          onChange={(title) => patch(block.id, { title })}
          placeholder="Video title"
          ariaLabel="Video title"
          className="block font-display text-sm font-semibold uppercase tracking-wide text-foreground"
        />
      </div>
    </div>
  );
}

function VideoProps({ block }: { block: VideoBlock }) {
  const { patch } = useEditor();
  return (
    <PropGroup label="Video">
      <PropSelect<"youtube" | "bunny">
        label="Provider"
        value={block.provider}
        onChange={(provider) => patch(block.id, { provider })}
        options={[
          { value: "youtube", label: "YouTube" },
          { value: "bunny", label: "Bunny Stream" },
        ]}
      />
      <PasteNormalize
        label="Paste a share link or embed code"
        hint={'https://youtu.be/… or a full <iframe …> snippet'}
        kind="video"
        provider={block.provider}
        onResult={(r) => {
          // parseVideoInput returns empty strings for parts it could not find;
          // patching those would wipe values the author already has.
          const next: Record<string, unknown> = {};
          if (typeof r.videoId === "string" && r.videoId) next.videoId = r.videoId;
          if (typeof r.libraryId === "string" && r.libraryId) {
            next.libraryId = r.libraryId;
          }
          if (Object.keys(next).length) patch(block.id, next);
        }}
      />
      <PropText
        label="Video ID"
        value={block.videoId}
        onChange={(videoId) => patch(block.id, { videoId })}
        placeholder="YouTube 11-char id or Bunny GUID"
      />
      <PropText
        label="Library ID"
        value={block.libraryId}
        onChange={(libraryId) => patch(block.id, { libraryId })}
        placeholder="Bunny library id"
        hint="Only meaningful for Bunny Stream."
      />
      <PropNumber
        label="Duration (seconds)"
        value={block.durationSec}
        onChange={(durationSec) => patch(block.id, { durationSec })}
        min={0}
        hint="Display-only — shown on the player chrome."
      />
    </PropGroup>
  );
}

// ---------------------------------------------------------------------------
// pdf
// ---------------------------------------------------------------------------

export function EditPdf({ block }: { block: PdfBlock }) {
  const { patch } = useEditor();
  const url = block.url.trim();
  return (
    <div className="bracket relative">
      <span className="tag-chip tag-chip-cyan absolute -top-3 left-4 z-10">
        // PDF
      </span>
      <div className="border border-border bg-well-strong px-5 py-6">
        <InlineText
          value={block.title}
          onChange={(title) => patch(block.id, { title })}
          placeholder="PDF title"
          ariaLabel="PDF title"
          className="block font-display text-sm font-semibold uppercase tracking-wide text-foreground"
        />
        <p className="mt-2 truncate font-mono text-[11px] text-muted">
          {url || "No PDF URL yet"}
        </p>
      </div>
    </div>
  );
}

function PdfProps({ block }: { block: PdfBlock }) {
  const { patch } = useEditor();
  return (
    <PropGroup label="PDF">
      <AssetUpload
        label="Upload a PDF"
        accept="application/pdf,.pdf"
        onUploaded={(a) =>
          patch(block.id, {
            url: a.url,
            ...(block.title.trim() ? {} : { title: a.filename }),
          })
        }
      />
      <PropText
        label="URL"
        value={block.url}
        onChange={(url) => patch(block.id, { url })}
        placeholder="/api/files/… or https://…"
      />
      <PropNumber
        label="Height"
        value={block.height}
        onChange={(height) => patch(block.id, { height })}
        min={0}
        hint="Pixels. 0 uses the default (720)."
      />
      <PropToggle
        label="Downloadable"
        value={block.downloadable}
        onChange={(downloadable) => patch(block.id, { downloadable })}
        hint="Show a download button on the viewer."
      />
    </PropGroup>
  );
}

// ---------------------------------------------------------------------------
// embed
// ---------------------------------------------------------------------------

export function EditEmbed({ block }: { block: EmbedBlock }) {
  const { patch } = useEditor();
  const url = block.url.trim();
  return (
    <div className="bracket relative">
      <span className="tag-chip tag-chip-cyan absolute -top-3 left-4 z-10">
        // EMBED
      </span>
      <div className="border border-border bg-well-strong px-5 py-6">
        <InlineText
          value={block.title}
          onChange={(title) => patch(block.id, { title })}
          placeholder="Embed title"
          ariaLabel="Embed title"
          className="block font-display text-sm font-semibold uppercase tracking-wide text-foreground"
        />
        <p className="mt-2 truncate font-mono text-[11px] text-muted">
          {url || "No embed URL yet"}
        </p>
      </div>
    </div>
  );
}

function EmbedProps({ block }: { block: EmbedBlock }) {
  const { patch } = useEditor();
  return (
    <PropGroup label="Embed">
      <PasteNormalize
        label="Paste a share link or embed code"
        hint={'https://… or a full <iframe …> snippet'}
        kind="embed"
        onResult={(r) => {
          const next: Record<string, unknown> = {};
          if (typeof r.url === "string" && r.url) next.url = r.url;
          // A provider that declared its own height is usually right; one that
          // did not returns 0, which must not clobber a height set by hand.
          if (typeof r.height === "number" && r.height > 0) next.height = r.height;
          if (Object.keys(next).length) patch(block.id, next);
        }}
      />
      <PropText
        label="URL"
        value={block.url}
        onChange={(url) => patch(block.id, { url })}
        placeholder="https://…"
      />
      <PropNumber
        label="Height"
        value={block.height}
        onChange={(height) => patch(block.id, { height })}
        min={0}
        hint="Pixels. 0 uses the provider default."
      />
    </PropGroup>
  );
}

// ---------------------------------------------------------------------------
// fileList
// ---------------------------------------------------------------------------

export function EditFileList({ block }: { block: FileListBlock }) {
  const { patch } = useEditor();
  const items = block.items;

  const updateItem = (id: string, partial: Partial<FileListItem>) => {
    patch(block.id, {
      items: items.map((it) => (it.id === id ? { ...it, ...partial } : it)),
    });
  };

  const removeItem = (id: string) => {
    patch(block.id, { items: items.filter((it) => it.id !== id) });
  };

  const addItem = () => {
    patch(block.id, {
      items: [
        ...items,
        { id: newBlockId(), url: "", label: "", description: "", meta: "" },
      ],
    });
  };

  return (
    <div className="panel rule-top p-5">
      <InlineText
        value={block.title}
        onChange={(title) => patch(block.id, { title })}
        placeholder="List title (optional)"
        ariaLabel="File list title"
        className="mb-4 block"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((it) => (
          <div
            key={it.id}
            className="group flex items-start gap-3 border border-border bg-surface-2 p-4"
          >
            <span className="mt-0.5 text-lg text-accent" aria-hidden>
              ⬇
            </span>
            <span className="min-w-0 flex-1">
              <InlineText
                value={it.label}
                onChange={(label) => updateItem(it.id, { label })}
                placeholder="File label"
                ariaLabel="File label"
                className="block font-display text-sm font-semibold uppercase tracking-wide text-foreground"
              />
              <InlineText
                value={it.description}
                onChange={(description) => updateItem(it.id, { description })}
                placeholder="Description (optional)"
                ariaLabel="File description"
                className="mt-0.5 block text-sm text-muted"
              />
              <InlineText
                value={it.meta}
                onChange={(meta) => updateItem(it.id, { meta })}
                placeholder="Meta (optional)"
                ariaLabel="File meta"
                className="mt-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-muted"
              />
            </span>
            <ItemControls
              removeLabel={`Remove file ${it.label.trim() || items.indexOf(it) + 1}`}
              onRemove={() => removeItem(it.id)}
            />
          </div>
        ))}
      </div>
      <div className="mt-3">
        <AddItemButton label="Add file" onClick={addItem} />
      </div>
    </div>
  );
}

function FileListProps({ block }: { block: FileListBlock }) {
  const { patch } = useEditor();
  const items = block.items;

  const updateItem = (id: string, partial: Partial<FileListItem>) => {
    patch(block.id, {
      items: items.map((it) => (it.id === id ? { ...it, ...partial } : it)),
    });
  };

  return (
    <PropGroup label="File list">
      <div className="grid gap-2">
        {items.length === 0 ? (
          <p className="text-[11px] text-muted">
            Add a file on the canvas to set its URL.
          </p>
        ) : (
          items.map((it, i) => (
            <div key={it.id} className="grid gap-1 border-t border-border/60 pt-2 first:border-t-0 first:pt-0">
              <PropText
                label={`URL — ${it.label.trim() || `File ${i + 1}`}`}
                value={it.url}
                onChange={(url) => updateItem(it.id, { url })}
                placeholder="/api/files/… or https://…"
              />
              <AssetUpload
                label="Upload"
                accept="*/*"
                onUploaded={(a) =>
                  // Fill label and meta only when blank — an upload should not
                  // silently rewrite text the author already wrote.
                  updateItem(it.id, {
                    url: a.url,
                    ...(it.label.trim() ? {} : { label: a.filename }),
                    ...(it.meta.trim() ? {} : { meta: a.meta }),
                  })
                }
              />
            </div>
          ))
        )}
      </div>
    </PropGroup>
  );
}

// ---------------------------------------------------------------------------
// email
// ---------------------------------------------------------------------------

export function EditEmail({ block }: { block: EmailBlock }) {
  const { patch } = useEditor();

  const headerField = (
    label: string,
    field: keyof Pick<EmailBlock, "from" | "to" | "cc" | "date" | "subject">,
    placeholder: string,
    ariaLabel: string,
  ) => (
    <div className="flex gap-3">
      <span className="w-16 shrink-0 pt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      <InlineText
        value={block[field]}
        onChange={(v) => patch(block.id, { [field]: v })}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        className="block flex-1 font-mono text-sm text-foreground"
      />
    </div>
  );

  return (
    <div className="panel rule-top border border-border">
      {/* Envelope header */}
      <div className="border-b border-border bg-surface-2 px-5 py-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm text-accent" aria-hidden>
            ✉
          </span>
          <span className="eyebrow eyebrow-muted">EMAIL · CASE ARTIFACT</span>
        </div>
        <div className="grid gap-1.5">
          {headerField("From", "from", "sender@example.com", "Email from")}
          {headerField("To", "to", "recipient@example.com", "Email to")}
          {headerField("Cc", "cc", "cc@example.com (optional)", "Email cc")}
          {headerField("Date", "date", "Date", "Email date")}
          {headerField("Subj", "subject", "Subject line", "Email subject")}
        </div>
      </div>
      {/* Body */}
      <div className="px-5 py-4">
        <InlineMarkdown
          value={block.bodyMarkdown}
          onChange={(bodyMarkdown) => patch(block.id, { bodyMarkdown })}
          placeholder="Email body in markdown…"
          proseClass={PROSE_INLINE}
          ariaLabel="Email body"
          minRows={3}
        />
      </div>
    </div>
  );
}

function EmailProps({ block }: { block: EmailBlock }) {
  const { patch } = useEditor();
  return (
    <PropGroup label="Email">
      <label className="grid gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          Attachments
        </span>
        <textarea
          value={block.attachments.join("\n")}
          onChange={(e) =>
            patch(block.id, {
              attachments: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
            })
          }
          placeholder={"one-filename-per-line.pdf\nphoto.png"}
          rows={4}
          aria-label="Email attachments — one filename per line"
          className="field w-full resize-y text-[13px]"
        />
        <span className="text-[11px] text-muted">
          One filename per line. Blank lines are ignored.
        </span>
      </label>
    </PropGroup>
  );
}

// ---------------------------------------------------------------------------
// Properties dispatcher for this group
// ---------------------------------------------------------------------------

export function MediaProps({
  block,
}: {
  block:
    | ImageBlock
    | VideoBlock
    | PdfBlock
    | EmbedBlock
    | FileListBlock
    | EmailBlock;
}) {
  switch (block.type) {
    case "image":
      return <ImageProps block={block} />;
    case "video":
      return <VideoProps block={block} />;
    case "pdf":
      return <PdfProps block={block} />;
    case "embed":
      return <EmbedProps block={block} />;
    case "fileList":
      return <FileListProps block={block} />;
    case "email":
      return <EmailProps block={block} />;
  }
}
