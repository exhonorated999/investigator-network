import type { Prisma } from "@/generated/prisma";
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

const inputClass = "field";

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
      <p className="eyebrow eyebrow-gold">// TEST BUILDER</p>
      <h2 className="display-sm mt-2 text-foreground">Test builder</h2>

      {/* Quiz settings */}
      <form action={updateQuiz} className="panel rule-top mt-4 flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="quizId" value={quiz.id} />
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="unitId" value={unitId} />
        <label className="grid flex-1 gap-1.5">
          <span className="eyebrow eyebrow-muted">Quiz title</span>
          <input name="title" defaultValue={quiz.title} className={inputClass} />
        </label>
        <label className="grid gap-1.5">
          <span className="eyebrow eyebrow-muted">Pass score (%)</span>
          <input
            name="passScore"
            type="number"
            min={0}
            max={100}
            defaultValue={quiz.passScore}
            className="field w-28"
          />
        </label>
        <button className="btn btn-ghost btn-sm">
          Save settings
        </button>
      </form>

      {/* Questions */}
      <div className="mt-6 space-y-4">
        {questions.length === 0 ? (
          <p className="panel px-4 py-4 text-[15px] text-muted">
            No questions yet. Add one below.
          </p>
        ) : (
          questions.map((q, i) => (
            <div key={q.id} className="panel rule-top p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
                  Q{String(i + 1).padStart(2, "0")} ·{" "}
                  {q.type === "MULTIPLE_CHOICE" ? "Multiple choice" : "Document upload"}
                </span>
                <form action={deleteQuestion}>
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="courseId" value={courseId} />
                  <input type="hidden" name="unitId" value={unitId} />
                  <button className="btn btn-ghost btn-sm border-danger/40 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)] hover:text-danger">
                    Delete
                  </button>
                </form>
              </div>

              <form action={updateQuestion} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={q.id} />
                <input type="hidden" name="courseId" value={courseId} />
                <input type="hidden" name="unitId" value={unitId} />
                <label className="grid flex-1 gap-1.5">
                  <span className="eyebrow eyebrow-muted">Prompt</span>
                  <input name="prompt" defaultValue={q.prompt} className={inputClass} />
                </label>
                <label className="grid gap-1.5">
                  <span className="eyebrow eyebrow-muted">Points</span>
                  <input
                    name="points"
                    type="number"
                    min={1}
                    defaultValue={q.points}
                    className="field w-24"
                  />
                </label>
                <button className="btn btn-ghost btn-sm">
                  Save
                </button>
              </form>

              {q.type === "MULTIPLE_CHOICE" ? (
                <div className="mt-4 space-y-2">
                  <p className="eyebrow eyebrow-muted">
                    Choices — select the radio to mark the correct answer
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
                          className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${
                            c.isCorrect
                              ? "border-accent-bright bg-accent-bright text-[#04212b]"
                              : "border-border text-transparent hover:border-accent-bright"
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
                          className="field flex-1"
                        />
                        <button className="btn btn-ghost btn-sm">
                          Save
                        </button>
                      </form>
                      <form action={deleteChoice}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="courseId" value={courseId} />
                        <input type="hidden" name="unitId" value={unitId} />
                        <button className="btn btn-ghost btn-sm border-danger/40 px-2 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)] hover:text-danger" title="Remove">
                          ✕
                        </button>
                      </form>
                    </div>
                  ))}
                  <form action={addChoice}>
                    <input type="hidden" name="questionId" value={q.id} />
                    <input type="hidden" name="courseId" value={courseId} />
                    <input type="hidden" name="unitId" value={unitId} />
                    <button className="btn btn-ghost btn-sm mt-1">
                      + Add choice
                    </button>
                  </form>
                </div>
              ) : (
                <p className="mt-3 border border-border bg-[rgba(10,12,17,0.6)] px-3 py-2 font-mono text-[11px] text-muted">
                  Learners upload a document. This question is graded manually in the
                  grading queue.
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add question */}
      <form action={addQuestion} className="panel rule-top mt-6 flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="quizId" value={quiz.id} />
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="unitId" value={unitId} />
        <label className="grid gap-1.5">
          <span className="eyebrow eyebrow-muted">Type</span>
          <select name="type" className="field w-auto" defaultValue="MULTIPLE_CHOICE">
            <option value="MULTIPLE_CHOICE">Multiple choice</option>
            <option value="DOCUMENT_UPLOAD">Document upload</option>
          </select>
        </label>
        <label className="grid flex-1 gap-1.5">
          <span className="eyebrow eyebrow-muted">Prompt</span>
          <input name="prompt" placeholder="Question prompt" className={inputClass} />
        </label>
        <label className="grid gap-1.5">
          <span className="eyebrow eyebrow-muted">Points</span>
          <input name="points" type="number" min={1} defaultValue={1} className="field w-24" />
        </label>
        <button className="btn btn-primary btn-sm">
          Add question
        </button>
      </form>
    </div>
  );
}
