import { marked } from "marked";
import { unitData, type LoadedUnit } from "@/lib/course";
import { submitAssignment } from "@/app/courses/actions";

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
    const youtubeId = String(d.youtubeId || "");
    if (!youtubeId) {
      return <Empty>No video has been added to this unit yet.</Empty>;
    }
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-black">
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
            title={unit.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  if (unit.type === "NOTES") {
    const md = String(d.contentMarkdown || "");
    if (!md.trim()) return <Empty>No notes have been added yet.</Empty>;
    const html = marked.parse(md, { async: false }) as string;
    return (
      <article
        className="prose-invert max-w-none rounded-xl border border-border bg-surface p-6 text-foreground [&_a]:text-accent [&_a]:underline [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2 [&_ul]:my-2"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (unit.type === "LIVE_SESSION") {
    const teamsJoinUrl = String(d.teamsJoinUrl || "");
    const startsAt = String(d.startsAt || "");
    const durationMin = d.durationMin ? Number(d.durationMin) : null;
    const replayUrl = String(d.replayUrl || "");
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center gap-2 text-accent">
          <span>📡</span>
          <span className="text-sm font-semibold uppercase tracking-wide">
            Live session (Microsoft Teams)
          </span>
        </div>
        {startsAt ? (
          <p className="mt-3 text-foreground">
            <span className="text-muted">Scheduled: </span>
            {fmtDateTime(startsAt)}
            {durationMin ? ` · ${durationMin} min` : ""}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">Schedule to be announced.</p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          {teamsJoinUrl ? (
            <a
              href={teamsJoinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-[#04212b] hover:bg-accent-strong"
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
              className="rounded-lg border border-border px-5 py-2.5 text-sm text-foreground hover:border-accent/60"
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
      <div className="rounded-xl border border-border bg-surface p-6">
        <h3 className="font-semibold text-foreground">Assignment</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
          {prompt || "Upload the required document to complete this unit."}
        </p>
        <form action={submitAssignment} className="mt-5 grid gap-3">
          <input type="hidden" name="unitId" value={unit.id} />
          <input type="hidden" name="slug" value={slug} />
          <input
            type="file"
            name="file"
            accept={allowed || undefined}
            required
            className="text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:text-foreground"
          />
          {allowed ? (
            <p className="text-xs text-muted">Allowed types: {allowed}</p>
          ) : null}
          <div>
            <button className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-[#04212b] hover:bg-accent-strong">
              Upload &amp; submit
            </button>
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
    <div className="rounded-xl border border-border bg-surface px-6 py-10 text-center text-sm text-muted">
      {children}
    </div>
  );
}
