import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UNIT_LABEL } from "@/lib/units";
import {
  parseVideoRef,
  formatDuration,
  bunnyConfigured,
  VIDEO_PROVIDERS,
} from "@/lib/video";
import { parseEmbedRef, embedLabel } from "@/lib/embed";
import { readNotesDoc } from "@/lib/blocks";
import { NotesBuilder } from "@/components/notes-builder";
import { updateUnit, deleteUnit } from "../../../actions";
import { sendLiveSessionReminders } from "../../../actions";
import { ensureQuiz } from "../../../quiz-actions";
import { QuizBuilder } from "@/components/quiz-builder";

export const dynamic = "force-dynamic";

const inputClass = "field";

export default async function UnitEditor({
  params,
}: {
  params: Promise<{ id: string; unitId: string }>;
}) {
  const { id: courseId, unitId } = await params;
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) notFound();

  // For QUIZ units, ensure a Quiz exists and load its questions/choices.
  let quiz = null;
  if (unit.type === "QUIZ") {
    await ensureQuiz(unit.id, unit.title);
    quiz = await prisma.quiz.findUnique({
      where: { unitId: unit.id },
      include: { questions: { include: { choices: true } } },
    });
  }

  const d = (unit.data as Record<string, unknown>) ?? {};
  const str = (k: string) => (d[k] == null ? "" : String(d[k]));
  const num = (k: string) => (d[k] == null ? "" : String(d[k]));
  const video = parseVideoRef(d);
  const embed = parseEmbedRef(d);
  const bunnyReady = bunnyConfigured();
  // Legacy contentMarkdown/embedUrl units are upgraded to blocks on read, so an
  // older NOTES unit opens in the builder with its content already in place.
  const notesBlocks = unit.type === "NOTES" ? readNotesDoc(d).blocks : [];

  const isNotes = unit.type === "NOTES";

  return (
    // A NOTES unit gets the full width so the builder can put a learner preview
    // beside the form; every other unit type is a short form and reads better
    // constrained.
    <div className={`reveal ${isNotes ? "max-w-[100rem]" : "max-w-3xl"}`}>
      <Link
        href={`/admin/courses/${courseId}`}
        className="eyebrow eyebrow-muted transition hover:text-accent-bright"
      >
        ← Back to course
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <h1 className="display-lg text-foreground">Edit unit</h1>
        <span className="inline-block border border-border-strong px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-bright">
          {UNIT_LABEL[unit.type]}
        </span>
      </div>

      <form action={updateUnit} className="mt-6 grid max-w-3xl gap-4">
        <input type="hidden" name="id" value={unit.id} />
        <input type="hidden" name="courseId" value={courseId} />

        <label className="grid gap-1.5">
          <span className="eyebrow eyebrow-muted">Unit title</span>
          <input name="title" defaultValue={unit.title} className={inputClass} />
        </label>

        {unit.type === "VIDEO" && (
          <>
            <label className="grid gap-1.5">
              <span className="eyebrow eyebrow-muted">Host</span>
              <select
                name="provider"
                defaultValue={video.provider}
                className={inputClass}
              >
                {VIDEO_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="eyebrow eyebrow-muted">Video URL or ID</span>
              <input
                name="videoRef"
                defaultValue={video.videoId}
                placeholder="Paste the Bunny embed URL, share link, or GUID"
                className={inputClass}
              />
              <span className="font-mono text-[11px] text-muted">
                Bunny: paste the embed/share URL or the video GUID. YouTube:
                paste the watch URL or the 11-character ID.
              </span>
            </label>
            {!bunnyReady && video.provider === "bunny" ? (
              <p className="border border-gold/40 bg-[rgba(244,162,97,0.08)] px-3 py-2 font-mono text-[11px] text-gold">
                BUNNY_STREAM_LIBRARY_ID is not set on the server, so Bunny
                videos will not play yet.
              </p>
            ) : null}
            <label className="grid gap-1.5">
              <span className="eyebrow eyebrow-muted">
                Library ID (optional — only if this video lives in a second
                Bunny library)
              </span>
              <input
                name="libraryId"
                defaultValue={video.libraryId}
                className={inputClass}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="eyebrow eyebrow-muted">
                Duration (seconds, optional)
                {video.durationSec
                  ? ` — currently ${formatDuration(video.durationSec)}`
                  : ""}
              </span>
              <input
                name="durationSec"
                type="number"
                defaultValue={num("durationSec")}
                className={inputClass}
              />
            </label>
          </>
        )}

        {unit.type === "NOTES" && (
          <p className="panel rule-top px-4 py-3 text-[15px] text-muted">
            Build the page content in the block builder below.
          </p>
        )}

        {unit.type === "LIVE_SESSION" && (
          <>
            <label className="grid gap-1.5">
              <span className="eyebrow eyebrow-muted">Microsoft Teams join URL</span>
              <input
                name="teamsJoinUrl"
                defaultValue={str("teamsJoinUrl")}
                placeholder="https://teams.microsoft.com/l/meetup-join/…"
                className={inputClass}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="eyebrow eyebrow-muted">Starts at</span>
                <input
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={str("startsAt")}
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="eyebrow eyebrow-muted">Duration (minutes)</span>
                <input
                  name="durationMin"
                  type="number"
                  defaultValue={num("durationMin")}
                  className={inputClass}
                />
              </label>
            </div>
            <label className="grid gap-1.5">
              <span className="eyebrow eyebrow-muted">Replay video URL (optional)</span>
              <input
                name="replayUrl"
                defaultValue={str("replayUrl")}
                placeholder="https://youtu.be/… (posted after the session)"
                className={inputClass}
              />
            </label>
            <p className="border border-border bg-[rgba(10,12,17,0.6)] px-3 py-2 font-mono text-[11px] text-muted">
              Paste a Teams link you created in Teams/Outlook. Automatic meeting
              creation (Microsoft Graph) is a later phase.
            </p>
          </>
        )}

        {unit.type === "FILE_ASSIGNMENT" && (
          <>
            <label className="grid gap-1.5">
              <span className="eyebrow eyebrow-muted">Assignment prompt</span>
              <textarea
                name="prompt"
                defaultValue={str("prompt")}
                rows={5}
                className={inputClass}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="eyebrow eyebrow-muted">Allowed file types</span>
              <input
                name="allowedFileTypes"
                defaultValue={str("allowedFileTypes")}
                placeholder=".pdf,.doc,.docx"
                className={inputClass}
              />
            </label>
          </>
        )}

        {unit.type === "CERTIFICATE" && (
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Certificate template</span>
            <input
              name="templateId"
              defaultValue={str("templateId") || "default"}
              className={inputClass}
            />
          </label>
        )}

        {unit.type === "QUIZ" && (
          <p className="panel rule-top px-4 py-3 text-[15px] text-muted">
            Configure the test questions in the builder below.
          </p>
        )}

        <div className="flex items-center gap-2">
          <button className="btn btn-primary btn-sm">
            Save unit
          </button>
        </div>
      </form>

      {isNotes ? (
        <NotesBuilder
          unitId={unit.id}
          courseId={courseId}
          blocks={notesBlocks}
        />
      ) : null}

      {unit.type === "QUIZ" && quiz ? (
        <QuizBuilder quiz={quiz} courseId={courseId} unitId={unit.id} />
      ) : null}

      {unit.type === "LIVE_SESSION" ? (
        <form action={sendLiveSessionReminders} className="panel rule-top mt-8 p-4">
          <input type="hidden" name="unitId" value={unit.id} />
          <input type="hidden" name="courseId" value={courseId} />
          <p className="eyebrow eyebrow-muted">Reminders</p>
          <p className="mt-2 font-mono text-[11px] text-muted">
            Email all enrolled learners a reminder with the schedule and Teams join
            link for this session.
          </p>
          <button className="btn btn-ghost btn-sm mt-3">
            Send reminder to enrolled learners
          </button>
        </form>
      ) : null}

      <form action={deleteUnit} className="mt-8">
        <input type="hidden" name="id" value={unit.id} />
        <input type="hidden" name="courseId" value={courseId} />
        <button className="btn btn-ghost btn-sm border-danger/40 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)] hover:text-danger">
          Delete unit
        </button>
      </form>
    </div>
  );
}
