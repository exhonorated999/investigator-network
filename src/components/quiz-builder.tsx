import type { Prisma } from "@prisma/client";
import {
  updateQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  addChoice,
  updateChoice,
  setCorrectChoice,
  deleteChoice,
} from "@/app/admin/courses/quiz-actions";

type QuizWithQuestions = Prisma.QuizGetPayload<{
  include: { questions: { include: { choices: true } } };
}>;

const inputClass =
  "rounded-lg border border-border bg-surface-2 px-3 py-2 text-foreground outline-none focus:border-accent";

export function QuizBuilder({
  quiz,
  courseId,
  unitId,
}: {
  quiz: QuizWithQuestions;
  courseId: string;
  unitId: string;
}) {
  const questions = [...quiz.questions].sort((a, b) => a.order - b.order);

  return (
    <div className="mt-8 border-t border-border pt-6">
      <h2 className="text-lg font-semibold text-foreground">Test builder</h2>

      {/* Quiz settings */}
      <form action={updateQuiz} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="quizId" value={quiz.id} />
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="unitId" value={unitId} />
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Quiz title</span>
          <input name="title" defaultValue={quiz.title} className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Pass score (%)</span>
          <input
            name="passScore"
            type="number"
            min={0}
            max={100}
            defaultValue={quiz.passScore}
            className={`${inputClass} w-28`}
          />
        </label>
        <button className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:border-accent/60">
          Save settings
        </button>
      </form>

      {/* Questions */}
      <div className="mt-6 space-y-5">
        {questions.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-4 py-4 text-sm text-muted">
            No questions yet. Add one below.
          </p>
        ) : (
          questions.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-accent">
                  Q{i + 1} ·{" "}
                  {q.type === "MULTIPLE_CHOICE" ? "Multiple choice" : "Document upload"}
                </span>
                <form action={deleteQuestion}>
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="courseId" value={courseId} />
                  <input type="hidden" name="unitId" value={unitId} />
                  <button className="text-xs text-danger hover:underline">Delete</button>
                </form>
              </div>

              <form action={updateQuestion} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={q.id} />
                <input type="hidden" name="courseId" value={courseId} />
                <input type="hidden" name="unitId" value={unitId} />
                <label className="grid flex-1 gap-1 text-sm">
                  <span className="text-muted">Prompt</span>
                  <input name="prompt" defaultValue={q.prompt} className={inputClass} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-muted">Points</span>
                  <input
                    name="points"
                    type="number"
                    min={1}
                    defaultValue={q.points}
                    className={`${inputClass} w-24`}
                  />
                </label>
                <button className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:border-accent/60">
                  Save
                </button>
              </form>

              {q.type === "MULTIPLE_CHOICE" ? (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-muted">
                    Choices — select the radio to mark the correct answer.
                  </p>
                  {q.choices.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <form action={setCorrectChoice}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="questionId" value={q.id} />
                        <input type="hidden" name="courseId" value={courseId} />
                        <input type="hidden" name="unitId" value={unitId} />
                        <button
                          title="Mark correct"
                          className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                            c.isCorrect
                              ? "border-success bg-success text-[#04212b]"
                              : "border-border text-transparent hover:border-accent"
                          }`}
                        >
                          ✓
                        </button>
                      </form>
                      <form action={updateChoice} className="flex flex-1 items-center gap-2">
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="courseId" value={courseId} />
                        <input type="hidden" name="unitId" value={unitId} />
                        <input
                          name="text"
                          defaultValue={c.text}
                          placeholder="Choice text"
                          className={`${inputClass} flex-1`}
                        />
                        <button className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:border-accent/60">
                          Save
                        </button>
                      </form>
                      <form action={deleteChoice}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="courseId" value={courseId} />
                        <input type="hidden" name="unitId" value={unitId} />
                        <button className="px-2 text-danger hover:underline" title="Remove">
                          ✕
                        </button>
                      </form>
                    </div>
                  ))}
                  <form action={addChoice}>
                    <input type="hidden" name="questionId" value={q.id} />
                    <input type="hidden" name="courseId" value={courseId} />
                    <input type="hidden" name="unitId" value={unitId} />
                    <button className="mt-1 text-sm text-accent hover:underline">
                      + Add choice
                    </button>
                  </form>
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
                  Learners upload a document. This question is graded manually in the
                  grading queue.
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add question */}
      <form action={addQuestion} className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
        <input type="hidden" name="quizId" value={quiz.id} />
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="unitId" value={unitId} />
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Type</span>
          <select name="type" className={inputClass} defaultValue="MULTIPLE_CHOICE">
            <option value="MULTIPLE_CHOICE">Multiple choice</option>
            <option value="DOCUMENT_UPLOAD">Document upload</option>
          </select>
        </label>
        <label className="grid flex-1 gap-1 text-sm">
          <span className="text-muted">Prompt</span>
          <input name="prompt" placeholder="Question prompt" className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Points</span>
          <input name="points" type="number" min={1} defaultValue={1} className={`${inputClass} w-24`} />
        </label>
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#04212b] hover:bg-accent-strong">
          Add question
        </button>
      </form>
    </div>
  );
}
