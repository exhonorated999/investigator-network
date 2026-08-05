import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { gradeAttempt } from "../actions";

export const dynamic = "force-dynamic";

const inputClass = "field";

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
    <div className="reveal max-w-3xl">
      <Link href="/admin/grading" className="eyebrow eyebrow-muted transition hover:text-accent-bright">
        ← Back to grading queue
      </Link>

      <h1 className="display-lg mt-3 text-foreground">Grade attempt</h1>
      <p className="mt-2 font-mono text-[12px] text-muted">
        {attempt.user.name} · {attempt.user.agency} —{" "}
        {attempt.quiz.unit.section.course.title} / {attempt.quiz.title} · pass mark{" "}
        {attempt.quiz.passScore}%
      </p>

      <form action={gradeAttempt} className="mt-6 space-y-4">
        <input type="hidden" name="attemptId" value={attempt.id} />

        {answers.map((a, i) => {
          const q = a.question;
          const selected = q.choices.find((c) => c.id === a.selectedChoiceId);
          const correct = q.choices.find((c) => c.isCorrect);
          // Multi-select: reconstruct chosen texts from the id array, and treat
          // "correct" as having earned full points (exact-match scoring).
          const pickedIds = Array.isArray(a.selectedChoiceIds)
            ? (a.selectedChoiceIds as string[])
            : [];
          const pickedTexts = q.choices
            .filter((c) => pickedIds.includes(c.id))
            .map((c) => c.text);
          const correctTexts = q.choices
            .filter((c) => c.isCorrect)
            .map((c) => c.text);
          const isCorrect = q.multiSelect
            ? q.points > 0 && (a.awardedPoints ?? 0) >= q.points
            : selected?.isCorrect;
          return (
            <div key={a.id} className={`panel rule-top p-4 ${q.type === "MULTIPLE_CHOICE" ? (isCorrect ? "rule-top" : "rule-top-danger") : "rule-top-gold"}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="flex-1 text-[15px] text-foreground">
                  <span className="font-mono text-[12px] text-accent">Q{String(i + 1).padStart(2, "0")}</span>
                  {" · "}
                  {q.prompt}
                </p>
                <span className="tag-chip shrink-0">
                  {q.points} pt{q.points === 1 ? "" : "s"}
                </span>
              </div>

              {q.type === "MULTIPLE_CHOICE" ? (
                <div className="mt-3 space-y-1.5 text-[14px]">
                  <p className="text-muted">
                    Answered:{" "}
                    <span className={isCorrect ? "text-success" : "text-danger"}>
                      {q.multiSelect
                        ? pickedTexts.join(", ") || "— no answer —"
                        : selected?.text || "— no answer —"}
                    </span>
                  </p>
                  {!isCorrect ? (
                    <p className="text-muted">
                      Correct:{" "}
                      <span className="text-success">
                        {q.multiSelect
                          ? correctTexts.join(", ")
                          : correct?.text}
                      </span>
                    </p>
                  ) : null}
                  <p className="font-mono text-[11px] text-muted">
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
                      className="btn btn-ghost btn-sm"
                    >
                      ↓ {a.uploadedFile.filename}
                    </a>
                  ) : (
                    <p className="text-[14px] text-danger">No file uploaded.</p>
                  )}
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="grid gap-1.5">
                      <span className="eyebrow eyebrow-muted">Points (0–{q.points})</span>
                      <input
                        name={`points_${a.id}`}
                        type="number"
                        min={0}
                        max={q.points}
                        defaultValue={a.awardedPoints ?? 0}
                        className="field w-28"
                      />
                    </label>
                    <label className="grid flex-1 gap-1.5">
                      <span className="eyebrow eyebrow-muted">Feedback (optional)</span>
                      <input
                        name={`feedback_${a.id}`}
                        defaultValue={a.feedback ?? ""}
                        className="field"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <p className="font-mono text-[12px] text-muted">Total available points: {total}</p>

        <button className="btn btn-primary">
          Finalize grade
        </button>
      </form>
    </div>
  );
}
