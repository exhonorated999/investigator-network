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
      <Banner tone="gold">
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
        <div className="mb-5 flex items-center gap-3">
          <span className="tag-chip tag-chip-cyan">
            // {quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"}
          </span>
          <span className="tag-chip">Pass mark {quiz.passScore}%</span>
        </div>
      )}

      <form
        action={submitAttempt}
        encType="multipart/form-data"
        className="space-y-6"
      >
        <input type="hidden" name="unitId" value={unitId} />
        <input type="hidden" name="slug" value={slug} />

        {quiz.questions.map((q, i) => (
          <fieldset
            key={q.id}
            className="panel rule-top p-5"
          >
            <legend className="flex items-center gap-3 px-1">
              <span className="font-mono text-sm font-bold text-accent-bright">
                Q{(i + 1).toString().padStart(2, "0")}
              </span>
              <span className="text-[15px] font-semibold text-foreground">
                {q.prompt}
              </span>
              <span className="tag-chip">
                {q.points} pt{q.points === 1 ? "" : "s"}
              </span>
            </legend>

            {q.type === "MULTIPLE_CHOICE" ? (
              <div className="mt-4 space-y-2.5">
                {q.choices.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-3 border border-border bg-well px-4 py-3 text-[15px] text-foreground transition hover:border-accent/50 hover:bg-[rgba(0,180,216,0.06)] has-[:checked]:border-accent has-[:checked]:bg-[rgba(0,180,216,0.1)] has-[:checked]:shadow-[0_0_16px_rgba(0,180,216,0.2)]"
                  >
                    <input
                      type="radio"
                      name={`q_${q.id}`}
                      value={c.id}
                      required
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    {c.text || <span className="text-muted">(empty choice)</span>}
                  </label>
                ))}
              </div>
            ) : (
              <div className="mt-4">
                <label className="group flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-accent/30 bg-[rgba(0,180,216,0.04)] px-6 py-8 text-center transition hover:border-accent/60 hover:bg-[rgba(0,180,216,0.08)]">
                  <span className="text-2xl text-accent">📎</span>
                  <span className="eyebrow">Drop file or click to browse</span>
                  <input
                    type="file"
                    name={`file_${q.id}`}
                    required
                    className="text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:text-foreground"
                  />
                </label>
                <p className="mt-2 font-mono text-xs text-muted">
                  Upload your document. This answer is graded by an instructor.
                </p>
              </div>
            )}
          </fieldset>
        ))}

        <button className="btn btn-primary">
          {failed ? "Resubmit test" : "Submit test"}
        </button>
      </form>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="panel rule-top px-6 py-12 text-center text-sm text-muted">
      {children}
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "gold" | "success" | "danger";
  children: React.ReactNode;
}) {
  const cls =
    tone === "success"
      ? "rule-top border-success/40 text-success"
      : tone === "danger"
        ? "rule-top-danger border-danger/40 text-danger"
        : "rule-top-gold border-gold/40 text-gold";
  return (
    <div className={`panel px-5 py-4 text-sm ${cls}`}>
      {children}
    </div>
  );
}
