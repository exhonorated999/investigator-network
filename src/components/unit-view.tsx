import { marked } from "marked";
import { unitData, type LoadedUnit } from "@/lib/course";
import { parseVideoRef, videoEmbed, formatDuration } from "@/lib/video";
import {
  parseEmbedRef,
  embedLabel,
  embedHeight,
  type EmbedRef,
} from "@/lib/embed";
import { submitAssignment } from "@/app/courses/actions";

const PROSE =
  "panel rule-top max-w-none p-6 text-foreground [&_a]:text-accent [&_a]:underline [&_a]:transition [&_a:hover]:text-accent-bright [&_blockquote]:border-l-2 [&_blockquote]:border-accent/40 [&_blockquote]:pl-4 [&_blockquote]:text-muted [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_code]:text-accent-bright [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:uppercase [&_h1]:tracking-wide [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-accent-bright [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wide [&_li]:my-1 [&_li]:relative [&_li]:pl-5 [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:text-accent [&_li]:before:content-['▸'] [&_p]:my-3 [&_p]:max-w-[68ch] [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-[rgba(10,12,17,0.85)] [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-sm [&_strong]:text-foreground [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-border [&_th]:bg-surface-2 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-display [&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-[0.14em] [&_th]:text-accent-bright [&_ul]:my-3 [&_ul]:list-none";

/** Flipbook / slide deck frame. Sized generously — a 400px deck is unreadable. */
function DocEmbed({
  embed,
  fallbackTitle,
}: {
  embed: EmbedRef;
  fallbackTitle: string;
}) {
  const height = embedHeight(embed);
  const title = embed.title || fallbackTitle;
  return (
    <div className="bracket relative">
      <span className="tag-chip tag-chip-cyan absolute -top-3 left-4 z-10">
        // {embedLabel(embed.url).toUpperCase()}
      </span>
      <a
        href={embed.url}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute -top-3 right-4 z-10 border border-border-strong bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition hover:border-accent hover:text-accent-bright"
      >
        Full screen ↗
      </a>
      <div className="overflow-hidden border border-border bg-[rgba(10,12,17,0.85)]">
        <iframe
          src={embed.url}
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

function fmtDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function UnitView({
  unit,
  slug,
}: {
  unit: LoadedUnit;
  slug: string;
}) {
  const d = unitData(unit);

  if (unit.type === "VIDEO") {
    const ref = parseVideoRef(d);
    const embed = videoEmbed(ref);
    if (!embed) {
      return ref.videoId ? (
        <Empty>
          This video is hosted on Bunny Stream but no library is configured on
          the server yet.
        </Empty>
      ) : (
        <Empty>No video has been added to this unit yet.</Empty>
      );
    }
    const duration = formatDuration(ref.durationSec);
    return (
      <div className="bracket scanlines relative">
        <span className="tag-chip tag-chip-cyan absolute -top-3 left-4 z-10">
          // PLAYBACK
        </span>
        {duration ? (
          <span className="absolute -top-3 right-4 z-10 border border-border-strong bg-surface px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] text-muted">
            {duration}
          </span>
        ) : null}
        <div className="overflow-hidden border border-border bg-black">
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              className="absolute inset-0 h-full w-full"
              src={embed.src}
              title={unit.title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    );
  }

  if (unit.type === "NOTES") {
    const md = String(d.contentMarkdown || "");
    const embed = parseEmbedRef(d);
    if (!md.trim() && !embed.url) {
      return <Empty>No notes have been added yet.</Empty>;
    }
    const html = md.trim()
      ? (marked.parse(md, { async: false }) as string)
      : "";
    return (
      <div className="grid gap-6">
        {embed.url ? (
          <DocEmbed embed={embed} fallbackTitle={unit.title} />
        ) : null}
        {html ? (
          <article
            className={PROSE}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : null}
      </div>
    );
  }

  if (unit.type === "LIVE_SESSION") {
    const teamsJoinUrl = String(d.teamsJoinUrl || "");
    const startsAt = String(d.startsAt || "");
    const durationMin = d.durationMin ? Number(d.durationMin) : null;
    const replayUrl = String(d.replayUrl || "");
    return (
      <div className="panel rule-top p-6">
        <div className="flex items-center gap-2">
          <span className="tag-chip tag-chip-cyan">// DISPATCH</span>
          <span className="eyebrow eyebrow-muted">Live session · Microsoft Teams</span>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="border border-border bg-[rgba(10,12,17,0.6)] p-4">
            <p className="eyebrow eyebrow-muted text-[10px]">Date / Time</p>
            <p className="mt-2 font-mono text-sm text-foreground">
              {startsAt ? fmtDateTime(startsAt) : "TBA"}
            </p>
          </div>
          <div className="border border-border bg-[rgba(10,12,17,0.6)] p-4">
            <p className="eyebrow eyebrow-muted text-[10px]">Duration</p>
            <p className="mt-2 font-mono text-sm text-foreground">
              {durationMin ? `${durationMin} min` : "—"}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {teamsJoinUrl ? (
            <a
              href={teamsJoinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              Join Teams meeting
            </a>
          ) : (
            <span className="text-sm text-muted">Join link not yet posted.</span>
          )}
          {replayUrl ? (
            <a
              href={replayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              Watch replay
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  if (unit.type === "FILE_ASSIGNMENT") {
    const prompt = String(d.prompt || "");
    const allowed = String(d.allowedFileTypes || "");
    return (
      <div className="panel rule-top p-6">
        <span className="tag-chip">// FILE SUBMISSION</span>
        <h3 className="display-sm mt-4">Assignment</h3>
        <p className="mt-3 max-w-[68ch] whitespace-pre-wrap text-[15px] text-muted">
          {prompt || "Upload the required document to complete this unit."}
        </p>
        <form action={submitAssignment} className="mt-6 grid gap-4">
          <input type="hidden" name="unitId" value={unit.id} />
          <input type="hidden" name="slug" value={slug} />
          <label className="group flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed border-accent/30 bg-[rgba(0,180,216,0.04)] px-6 py-10 text-center transition hover:border-accent/60 hover:bg-[rgba(0,180,216,0.08)]">
            <span className="text-3xl text-accent transition group-hover:scale-110">📎</span>
            <span className="eyebrow">Drop file or click to browse</span>
            <input
              type="file"
              name="file"
              accept={allowed || undefined}
              required
              className="text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:text-foreground"
            />
          </label>
          {allowed ? (
            <p className="font-mono text-xs text-muted">
              Allowed types: {allowed}
            </p>
          ) : null}
          <div>
            <button className="btn btn-primary">Upload &amp; submit</button>
          </div>
        </form>
      </div>
    );
  }

  if (unit.type === "QUIZ") {
    return (
      <Empty>
        The test builder and learner test-taking experience arrive in Phase 5.
      </Empty>
    );
  }

  if (unit.type === "CERTIFICATE") {
    return (
      <Empty>
        Certificates are issued automatically on course completion (Phase 6).
      </Empty>
    );
  }

  return <Empty>Unsupported unit type.</Empty>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="panel rule-top px-6 py-12 text-center text-sm text-muted">
      {children}
    </div>
  );
}
