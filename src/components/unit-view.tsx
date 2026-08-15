import { unitData, type LoadedUnit } from "@/lib/course";
import { parseVideoRef, videoEmbed, formatDuration } from "@/lib/video";
import { submitAssignment } from "@/app/courses/actions";
import { VideoPlayer } from "./video-player";
import { LiveSession } from "./live-session";
import { readNotesDoc, isEmptyDoc } from "@/lib/blocks";
import { BlockList } from "./blocks/block-list";

export interface AssignmentState {
  status: "PENDING_GRADING" | "PASSED" | "FAILED";
  feedback: string | null;
}

export function UnitView({
  unit,
  slug,
  submission = null,
}: {
  unit: LoadedUnit;
  slug: string;
  submission?: AssignmentState | null;
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
      <VideoPlayer src={embed.src} title={unit.title} duration={duration} />
    );
  }

  if (unit.type === "NOTES") {
    const doc = readNotesDoc(d);
    if (isEmptyDoc(doc)) return <Empty>No notes have been added yet.</Empty>;
    return <BlockList blocks={doc.blocks} />;
  }

  if (unit.type === "LIVE_SESSION") {
    const teamsJoinUrl = String(d.teamsJoinUrl || "");
    const startsAt = String(d.startsAt || "");
    const durationMin = d.durationMin ? Number(d.durationMin) : null;
    const replayUrl = String(d.replayUrl || "");
    return (
      <LiveSession
        title={unit.title}
        teamsJoinUrl={teamsJoinUrl}
        startsAt={startsAt}
        durationMin={durationMin}
        replayUrl={replayUrl}
      />
    );
  }

  if (unit.type === "FILE_ASSIGNMENT") {
    const prompt = String(d.prompt || "");
    const allowed = String(d.allowedFileTypes || "");
    const isGraded = unit.completionRule === "GRADED";
    const status = isGraded ? submission?.status ?? null : null;
    const feedback = submission?.feedback ?? null;
    // The upload form is shown when the learner has no active submission —
    // i.e. never submitted, or a previous one was FAILED (resubmit allowed).
    const showForm = !isGraded || status === null || status === "FAILED";

    return (
      <div className="panel rule-top p-6">
        <span className="tag-chip">// FILE SUBMISSION</span>
        <h3 className="display-sm mt-4">Assignment</h3>
        <p className="mt-3 max-w-[68ch] whitespace-pre-wrap text-[15px] text-muted">
          {prompt || "Upload the required document to complete this unit."}
        </p>

        {isGraded ? (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            Reviewed by an instructor · pass / fail
          </p>
        ) : null}

        {status === "PASSED" ? (
          <div className="mt-5 border border-success/40 bg-[rgba(74,222,128,0.08)] px-4 py-3">
            <p className="text-[15px] text-success">✓ Passed — this exercise is complete.</p>
            {feedback ? (
              <p className="mt-1.5 text-[14px] text-muted">
                <span className="text-muted/70">Instructor note:</span> {feedback}
              </p>
            ) : null}
          </div>
        ) : status === "PENDING_GRADING" ? (
          <div className="mt-5 border border-accent/40 bg-[rgba(0,180,216,0.06)] px-4 py-3">
            <p className="text-[15px] text-accent-bright">
              ⏳ Submitted — awaiting instructor review.
            </p>
          </div>
        ) : status === "FAILED" ? (
          <div className="mt-5 border border-danger/40 bg-[rgba(239,68,68,0.08)] px-4 py-3">
            <p className="text-[15px] text-danger">
              ✕ Not passed — please review and resubmit.
            </p>
            {feedback ? (
              <p className="mt-1.5 text-[14px] text-muted">
                <span className="text-muted/70">Instructor note:</span> {feedback}
              </p>
            ) : null}
          </div>
        ) : null}

        {showForm ? (
          <form action={submitAssignment} className="mt-6 grid gap-4">
            <input type="hidden" name="unitId" value={unit.id} />
            <input type="hidden" name="slug" value={slug} />
            <label className="group flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed border-accent/30 bg-[rgba(0,180,216,0.04)] px-6 py-10 text-center transition hover:border-accent/60 hover:bg-[rgba(0,180,216,0.08)]">
              <span className="text-3xl text-accent transition group-hover:scale-110">📎</span>
              <span className="eyebrow">
                {status === "FAILED" ? "Upload a new file to resubmit" : "Drop file or click to browse"}
              </span>
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
              <button className="btn btn-primary">
                {isGraded ? "Upload for review" : "Upload & submit"}
              </button>
            </div>
          </form>
        ) : null}
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
