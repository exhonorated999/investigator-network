import { prisma } from "@/lib/prisma";

/**
 * Post-test answer review. Shown once an attempt is GRADED so a learner can see
 * exactly which questions they missed and what the correct answer was, without
 * having to contact an instructor. Works on any quiz that has a graded attempt —
 * everything it needs (the learner's selections + which choices are correct) is
 * already recorded at submit time.
 *
 * Only auto-graded MULTIPLE_CHOICE questions get a right/wrong breakdown.
 * DOCUMENT_UPLOAD questions are shown with any instructor feedback instead, since
 * there is no single "correct choice" to reveal.
 */
export async function AttemptReview({ attemptId }: { attemptId: string }) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: {
        include: {
          question: {
            include: { choices: { orderBy: { id: "asc" } } },
          },
        },
      },
    },
  });
  if (!attempt) return null;

  // Order answers by their question's authored order.
  const answers = [...attempt.answers].sort(
    (a, b) => a.question.order - b.question.order,
  );
  const mcAnswers = answers.filter((a) => a.question.type === "MULTIPLE_CHOICE");
  if (mcAnswers.length === 0) return null;

  const wrongCount = mcAnswers.filter(
    (a) => (a.awardedPoints ?? 0) < a.question.points,
  ).length;

  return (
    <details className="panel mt-5 overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-foreground hover:bg-white/[0.02]">
        <span className="flex items-center gap-2">
          <span className="tag-chip tag-chip-cyan">Review answers</span>
          {wrongCount > 0 ? (
            <span className="text-muted">
              {wrongCount} question{wrongCount === 1 ? "" : "s"} to review
            </span>
          ) : (
            <span className="text-success">All correct</span>
          )}
        </span>
        <span className="text-muted transition-transform">▾</span>
      </summary>

      <div className="space-y-6 border-t border-border px-5 py-6">
        {mcAnswers.map((a, i) => {
          const q = a.question;
          const isCorrect = (a.awardedPoints ?? 0) >= q.points;
          const picked = new Set<string>(
            q.multiSelect
              ? ((a.selectedChoiceIds as string[] | null) ?? [])
              : a.selectedChoiceId
                ? [a.selectedChoiceId]
                : [],
          );

          return (
            <div key={a.id}>
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 shrink-0 font-mono text-xs ${
                    isCorrect ? "text-success" : "text-danger"
                  }`}
                >
                  {isCorrect ? "✓" : "✕"}
                </span>
                <div className="flex-1">
                  <p className="text-[15px] font-medium text-foreground">
                    <span className="mr-2 font-mono text-xs text-muted">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {q.prompt}
                  </p>

                  <ul className="mt-3 space-y-1.5">
                    {q.choices.map((c) => {
                      const chosen = picked.has(c.id);
                      const tone = c.isCorrect
                        ? "border-success/40 bg-success/5 text-foreground"
                        : chosen
                          ? "border-danger/40 bg-danger/5 text-foreground"
                          : "border-border text-muted";
                      return (
                        <li
                          key={c.id}
                          className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${tone}`}
                        >
                          <span>{c.text}</span>
                          <span className="flex shrink-0 items-center gap-2 font-mono text-[11px] uppercase tracking-wide">
                            {chosen && (
                              <span
                                className={
                                  c.isCorrect ? "text-success" : "text-danger"
                                }
                              >
                                Your answer
                              </span>
                            )}
                            {c.isCorrect && (
                              <span className="text-success">✓ Correct</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {a.feedback && (
                    <p className="mt-2 text-sm text-muted">
                      <span className="text-foreground">Note:</span> {a.feedback}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
