import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { gradeAttempt } from "../actions";

export const dynamic = "force-dynamic";

const inputClass =
  "rounded-lg border border-border bg-surface-2 px-3 py-2 text-foreground outline-none focus:border-accent";

export default async function GradeAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      user: true,
      quiz: { include: { unit: { include: { section: { include: { course: true } } } } } },
      answers: {
        include: { question: { include: { choices: true } }, uploadedFile: true },
      },
    },
  });
  if (!attempt) notFound();

  const answers = [...attempt.answers].sort(
    (a, b) => a.question.order - b.question.order
  );
  const total = answers.reduce((n, a) => n + a.question.points, 0) || 1;

  return (
    <div className="max-w-3xl">
      <Link href="/admin/grading" className="text-sm text-accent hover:underline">
        ← Back to grading queue
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-foreground">Grade attempt</h1>
      <p className="mt-1 text-sm text-muted">
        {attempt.user.name} · {attempt.user.agency} —{" "}
        {attempt.quiz.unit.section.course.title} / {attempt.quiz.title} · pass mark{" "}
        {attempt.quiz.passScore}%
      </p>

      <form action={gradeAttempt} className="mt-6 space-y-5">
        <input type="hidden" name="attemptId" value={attempt.id} />

        {answers.map((a, i) => {
          const q = a.question;
          const selected = q.choices.find((c) => c.id === a.selectedChoiceId);
          const correct = q.choices.find((c) => c.isCorrect);
          return (
            <div key={a.id} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-foreground">
                {i + 1}. {q.prompt}
                <span className="ml-2 text-xs font-normal text-muted">
                  ({q.points} pt{q.points === 1 ? "" : "s"})
                </span>
              </p>

              {q.type === "MULTIPLE_CHOICE" ? (
                <div className="mt-3 text-sm">
                  <p className="text-muted">
                    Answered:{" "}
                    <span
                      className={
                        selected?.isCorrect ? "text-success" : "text-danger"
                      }
                    >
                      {selected?.text || "— no answer —"}
                    </span>
                  </p>
                  {!selected?.isCorrect ? (
                    <p className="text-muted">
                      Correct: <span className="text-success">{correct?.text}</span>
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted">
                    Auto-scored: {a.awardedPoints ?? 0}/{q.points}
                  </p>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {a.uploadedFile ? (
                    <a
                      href={`/api/files/${a.uploadedFile.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block rounded-lg border border-border px-3 py-1.5 text-sm text-accent hover:border-accent/60"
                    >
                      ↓ {a.uploadedFile.filename}
                    </a>
                  ) : (
                    <p className="text-sm text-danger">No file uploaded.</p>
                  )}
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="grid gap-1 text-sm">
                      <span className="text-muted">Points (0–{q.points})</span>
                      <input
                        name={`points_${a.id}`}
                        type="number"
                        min={0}
                        max={q.points}
                        defaultValue={a.awardedPoints ?? 0}
                        className={`${inputClass} w-28`}
                      />
                    </label>
                    <label className="grid flex-1 gap-1 text-sm">
                      <span className="text-muted">Feedback (optional)</span>
                      <input
                        name={`feedback_${a.id}`}
                        defaultValue={a.feedback ?? ""}
                        className={inputClass}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <p className="text-sm text-muted">Total available points: {total}</p>

        <button className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-[#04212b] hover:bg-accent-strong">
          Finalize grade
        </button>
      </form>
    </div>
  );
}
