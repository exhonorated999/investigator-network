import { marked } from "marked";
import type {
  ImageBlock,
  VideoBlock,
  PdfBlock,
  EmbedBlock,
  FileListBlock,
  EmailBlock,
  MediaWidth,
} from "@/lib/blocks";
import { videoEmbed, formatDuration, type VideoRef } from "@/lib/video";
import { embedLabel, embedHeight, type EmbedRef } from "@/lib/embed";
import { VideoPlayer } from "@/components/video-player";
import { PROSE_INLINE } from "./prose";

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
// image
// ---------------------------------------------------------------------------

const WIDTH_CLASS: Record<MediaWidth, string> = {
  normal: "max-w-2xl",
  wide: "max-w-5xl",
  full: "w-full",
};

export function ImageBlockView({ block }: { block: ImageBlock }) {
  const url = block.url.trim();
  if (!url) return null;
  const caption = block.caption.trim();
  const widthClass = WIDTH_CLASS[block.width] ?? WIDTH_CLASS.normal;
  return (
    <figure className={widthClass}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={block.alt.trim() || caption || ""}
        className="w-full border border-border"
        loading="lazy"
      />
      {caption ? (
        <figcaption className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-muted">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// video
// ---------------------------------------------------------------------------

export function VideoBlockView({ block }: { block: VideoBlock }) {
  const ref: VideoRef = {
    provider: block.provider,
    videoId: block.videoId.trim(),
    libraryId: block.libraryId.trim(),
    durationSec: block.durationSec,
  };
  const embed = videoEmbed(ref);
  if (!embed) {
    return (
      <div className="panel rule-top px-6 py-10 text-center text-sm text-muted">
        {ref.videoId
          ? "This video is hosted on Bunny Stream but no library is configured on the server yet."
          : "No video has been added yet."}
      </div>
    );
  }
  const duration = formatDuration(ref.durationSec);
  const title = block.title.trim() || "Video";
  return <VideoPlayer src={embed.src} title={title} duration={duration} />;
}

// ---------------------------------------------------------------------------
// pdf
// ---------------------------------------------------------------------------

export function PdfBlockView({ block }: { block: PdfBlock }) {
  const url = block.url.trim();
  if (!url) return null;
  const height = block.height > 0 ? block.height : 720;
  const title = block.title.trim() || "PDF Document";
  return (
    <div className="bracket relative">
      <span className="tag-chip tag-chip-cyan absolute -top-3 left-4 z-10">
        // PDF
      </span>
      {block.downloadable ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute -top-3 right-4 z-10 border border-border-strong bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition hover:border-accent hover:text-accent-bright"
        >
          Download ↗
        </a>
      ) : null}
      <div className="overflow-hidden border border-border bg-[rgba(10,12,17,0.85)]">
        <iframe
          src={url}
          title={title}
          loading="lazy"
          className="block w-full"
          style={{ height: `min(${height}px, 80vh)`, border: "none" }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// embed
// ---------------------------------------------------------------------------

export function EmbedBlockView({ block }: { block: EmbedBlock }) {
  const url = block.url.trim();
  if (!url) return null;
  const embed: EmbedRef = {
    url,
    height: block.height,
    title: block.title,
  };
  const height = embedHeight(embed);
  const title = block.title.trim() || "Embedded content";
  const label = embedLabel(url);
  return (
    <div className="bracket relative">
      <span className="tag-chip tag-chip-cyan absolute -top-3 left-4 z-10">
        // {label.toUpperCase()}
      </span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute -top-3 right-4 z-10 border border-border-strong bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition hover:border-accent hover:text-accent-bright"
      >
        Full screen ↗
      </a>
      <div className="overflow-hidden border border-border bg-[rgba(10,12,17,0.85)]">
        <iframe
          src={url}
          title={title}
          loading="lazy"
          scrolling="no"
          allow="autoplay; fullscreen; clipboard-write"
          allowFullScreen
          className="block w-full"
          style={{ height: `min(${height}px, 80vh)`, border: "none" }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// fileList
// ---------------------------------------------------------------------------

export function FileListBlockView({ block }: { block: FileListBlock }) {
  const items = block.items.filter((it) => it.url.trim() || it.label.trim());
  if (!items.length) return null;
  const title = block.title.trim();
  return (
    <div className="panel rule-top p-5">
      {title ? (
        <span className="tag-chip mb-4 inline-flex">// {title.toUpperCase()}</span>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((it) => {
          const url = it.url.trim();
          const label = it.label.trim() || "Download";
          return (
            <a
              key={it.id}
              href={url || undefined}
              className="group flex items-start gap-3 border border-border bg-surface-2 p-4 transition hover:border-accent/50 hover:bg-[rgba(0,180,216,0.04)]"
              {...(url
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              <span className="mt-0.5 text-lg text-accent transition group-hover:scale-110" aria-hidden>
                ⬇
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-sm font-semibold uppercase tracking-wide text-foreground">
                  {label}
                </span>
                {it.description.trim() ? (
                  <span className="mt-0.5 block text-sm text-muted">
                    {it.description}
                  </span>
                ) : null}
                {it.meta.trim() ? (
                  <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    {it.meta}
                  </span>
                ) : null}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// email
// ---------------------------------------------------------------------------

export function EmailBlockView({ block }: { block: EmailBlock }) {
  const subject = block.subject.trim();
  const body = md(block.bodyMarkdown);
  const attachments = block.attachments.filter((a) => a.trim());

  // If there's nothing at all, render nothing.
  if (!subject && !body && !block.from.trim() && !block.to.trim()) return null;

  const headerRow = (label: string, value: string) =>
    value.trim() ? (
      <div className="flex gap-3">
        <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          {label}
        </span>
        <span className="font-mono text-sm text-foreground">{value}</span>
      </div>
    ) : null;

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
          {headerRow("From", block.from)}
          {headerRow("To", block.to)}
          {headerRow("Cc", block.cc)}
          {headerRow("Date", block.date)}
          {headerRow("Subj", subject)}
        </div>
      </div>
      {/* Body */}
      {body ? (
        <div
          className={`px-5 py-4 ${PROSE_INLINE}`}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      ) : null}
      {/* Attachments */}
      {attachments.length ? (
        <div className="border-t border-border px-5 py-3">
          <span className="eyebrow eyebrow-muted mb-2 block">
            Attachments ({attachments.length})
          </span>
          <div className="flex flex-wrap gap-2">
            {attachments.map((name, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 border border-border bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-muted"
              >
                <span aria-hidden>📎</span>
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
