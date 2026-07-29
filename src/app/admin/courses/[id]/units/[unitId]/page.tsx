import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UNIT_LABEL } from "@/lib/units";
import { updateUnit, deleteUnit } from "../../../actions";
import { sendLiveSessionReminders } from "../../../actions";
import { ensureQuiz } from "../../../quiz-actions";
import { QuizBuilder } from "@/components/quiz-builder";

export const dynamic = "force-dynamic";

const inputClass =
  "rounded-lg border border-border bg-surface-2 px-3 py-2 text-foreground outline-none focus:border-accent";

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

  return (
    <div className="max-w-3xl">
      <Link
        href={`/admin/courses/${courseId}`}
        className="text-sm text-accent hover:underline"
      >
        ← Back to course
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Edit unit</h1>
        <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">
          {UNIT_LABEL[unit.type]}
        </span>
      </div>

      <form action={updateUnit} className="mt-6 grid gap-4">
        <input type="hidden" name="id" value={unit.id} />
        <input type="hidden" name="courseId" value={courseId} />

        <label className="grid gap-1 text-sm">
          <span className="text-muted">Unit title</span>
          <input name="title" defaultValue={unit.title} className={inputClass} />
        </label>

        {unit.type === "VIDEO" && (
          <>
            <label className="grid gap-1 text-sm">
              <span className="text-muted">
                YouTube URL or video ID (unlisted recommended)
              </span>
              <input
                name="youtubeId"
                defaultValue={str("youtubeId")}
                placeholder="https://youtu.be/… or 11-char ID"
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Duration (seconds, optional)</span>
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
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Notes content (Markdown supported)</span>
            <textarea
              name="contentMarkdown"
              defaultValue={str("contentMarkdown")}
              rows={14}
              className={`${inputClass} font-mono text-sm`}
            />
          </label>
        )}

        {unit.type === "LIVE_SESSION" && (
          <>
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Microsoft Teams join URL</span>
              <input
                name="teamsJoinUrl"
                defaultValue={str("teamsJoinUrl")}
                placeholder="https://teams.microsoft.com/l/meetup-join/…"
                className={inputClass}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-muted">Starts at</span>
                <input
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={str("startsAt")}
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted">Duration (minutes)</span>
                <input
                  name="durationMin"
                  type="number"
                  defaultValue={num("durationMin")}
                  className={inputClass}
                />
              </label>
            </div>
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Replay video URL (optional)</span>
              <input
                name="replayUrl"
                defaultValue={str("replayUrl")}
                placeholder="https://youtu.be/… (posted after the session)"
                className={inputClass}
              />
            </label>
            <p className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted">
              Paste a Teams link you created in Teams/Outlook. Automatic meeting
              creation (Microsoft Graph) is a later phase.
            </p>
          </>
        )}

        {unit.type === "FILE_ASSIGNMENT" && (
          <>
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Assignment prompt</span>
              <textarea
                name="prompt"
                defaultValue={str("prompt")}
                rows={5}
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Allowed file types</span>
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
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Certificate template</span>
            <input
              name="templateId"
              defaultValue={str("templateId") || "default"}
              className={inputClass}
            />
          </label>
        )}

        {unit.type === "QUIZ" && (
          <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
            Configure the test questions in the builder below.
          </p>
        )}

        <div className="flex items-center gap-2">
          <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#04212b] hover:bg-accent-strong">
            Save unit
          </button>
        </div>
      </form>

      {unit.type === "QUIZ" && quiz ? (
        <QuizBuilder quiz={quiz} courseId={courseId} unitId={unit.id} />
      ) : null}

      {unit.type === "LIVE_SESSION" ? (
        <form action={sendLiveSessionReminders} className="mt-8 rounded-lg border border-border bg-surface p-4">
          <input type="hidden" name="unitId" value={unit.id} />
          <input type="hidden" name="courseId" value={courseId} />
          <p className="text-sm text-foreground">Reminders</p>
          <p className="mt-1 text-xs text-muted">
            Email all enrolled learners a reminder with the schedule and Teams join
            link for this session.
          </p>
          <button className="mt-3 rounded-lg border border-accent/50 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10">
            Send reminder to enrolled learners
          </button>
        </form>
      ) : null}

      <form action={deleteUnit} className="mt-8">
        <input type="hidden" name="id" value={unit.id} />
        <input type="hidden" name="courseId" value={courseId} />
        <button className="rounded-lg border border-danger/40 px-3 py-1.5 text-sm text-danger hover:bg-danger/10">
          Delete unit
        </button>
      </form>
    </div>
  );
}
