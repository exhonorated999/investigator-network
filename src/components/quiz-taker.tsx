import { prisma } from "@/lib/prisma";
import { QuizForm, type QuizFormQuestion } from "@/components/quiz-form";

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

  // Resume support: rehydrate any saved-but-unsubmitted answers.
  const draftRow = await prisma.quizDraft.findUnique({
    where: { userId_quizId: { userId, quizId: quiz.id } },
    select: { answers: true },
  });
  const initialDraft = (draftRow?.answers ?? {}) as Record<
    string,
    string | string[]
  >;

  const questions: QuizFormQuestion[] = quiz.questions.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    points: q.points,
    multiSelect: q.multiSelect,
    choices: q.choices.map((c) => ({ id: c.id, text: c.text })),
  }));

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

      <QuizForm
        unitId={unitId}
        slug={slug}
        questions={questions}
        initialDraft={initialDraft}
        submitLabel={failed ? "Resubmit test" : "Submit test"}
      />
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
