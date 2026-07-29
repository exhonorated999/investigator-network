import { prisma } from "@/lib/prisma";
import { submitAttempt } from "@/app/courses/actions";

export async function QuizTaker({
  unitId,
  slug,
  userId,
}: {
  unitId: string;
  slug: string;
  userId: string;
}) {
  const quiz = await prisma.quiz.findUnique({
    where: { unitId },
    include: { questions: { include: { choices: true }, orderBy: { order: "asc" } } },
  });

  if (!quiz) {
    return <Empty>This test has not been configured yet.</Empty>;
  }
  if (quiz.questions.length === 0) {
    return <Empty>This test has no questions yet.</Empty>;
  }

  const latest = await prisma.attempt.findFirst({
    where: { quizId: quiz.id, userId },
    orderBy: { submittedAt: "desc" },
  });

  // Result banners
  if (latest && latest.status === "PENDING_GRADING") {
    return (
      <Banner tone="info">
        Your submission was received and is awaiting instructor grading. You will be
        able to see your result here once it is graded.
      </Banner>
    );
  }
  if (latest && latest.status === "GRADED" && latest.passed) {
    return (
      <Banner tone="success">
        ✓ Passed — score {latest.score}% (pass mark {quiz.passScore}%).
      </Banner>
    );
  }

  const failed = latest && latest.status === "GRADED" && !latest.passed;

  return (
    <div>
      {failed ? (
        <Banner tone="danger">
          Not passed — score {latest!.score}% (pass mark {quiz.passScore}%). Review and
          try again below.
        </Banner>
      ) : (
        <p className="mb-4 text-sm text-muted">
          {quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"} · pass
          mark {quiz.passScore}%
        </p>
      )}

      <form
        action={submitAttempt}
        encType="multipart/form-data"
        className="space-y-5"
      >
        <input type="hidden" name="unitId" value={unitId} />
        <input type="hidden" name="slug" value={slug} />

        {quiz.questions.map((q, i) => (
          <fieldset
            key={q.id}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <legend className="px-1 text-sm font-semibold text-foreground">
              {i + 1}. {q.prompt}
              <span className="ml-2 text-xs font-normal text-muted">
                ({q.points} pt{q.points === 1 ? "" : "s"})
              </span>
            </legend>

            {q.type === "MULTIPLE_CHOICE" ? (
              <div className="mt-3 space-y-2">
                {q.choices.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:border-accent/60"
                  >
                    <input
                      type="radio"
                      name={`q_${q.id}`}
                      value={c.id}
                      required
                      className="accent-[var(--accent)]"
                    />
                    {c.text || <span className="text-muted">(empty choice)</span>}
                  </label>
                ))}
              </div>
            ) : (
              <div className="mt-3">
                <input
                  type="file"
                  name={`file_${q.id}`}
                  required
                  className="text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:text-foreground"
                />
                <p className="mt-1 text-xs text-muted">
                  Upload your document. This answer is graded by an instructor.
                </p>
              </div>
            )}
          </fieldset>
        ))}

        <button className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-[#04212b] hover:bg-accent-strong">
          {failed ? "Resubmit test" : "Submit test"}
        </button>
      </form>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-10 text-center text-sm text-muted">
      {children}
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "info" | "success" | "danger";
  children: React.ReactNode;
}) {
  const cls =
    tone === "success"
      ? "border-success/40 text-success"
      : tone === "danger"
        ? "border-danger/40 text-danger"
        : "border-accent/40 text-accent";
  return (
    <div className={`rounded-xl border bg-surface px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}
