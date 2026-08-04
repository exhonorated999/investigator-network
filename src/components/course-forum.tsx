import type { ForumQuestion } from "@/lib/course-forum";
import { askQuestion, answerQuestion, setQuestionResolved } from "@/app/courses/[slug]/forum-actions";

function fmt(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Per-course discussion forum. Enrolled learners ask questions; peers and staff
 * answer. Staff answers are badged and auto-resolve the thread. Rendered on the
 * course overview for anyone who can participate.
 */
export function CourseForum({
  courseId,
  slug,
  questions,
  viewerId,
  isAdmin,
}: {
  courseId: string;
  slug: string;
  questions: ForumQuestion[];
  viewerId: string;
  isAdmin: boolean;
}) {
  return (
    <section className="reveal reveal-3 mt-12">
      <header className="flex items-end justify-between gap-4 border-b border-border pb-3">
        <div>
          <p className="eyebrow eyebrow-gold">02 / Discussion</p>
          <h2 className="display-lg mt-2">Questions &amp; answers</h2>
        </div>
        <span className="font-mono text-xs text-muted">
          {questions.length.toString().padStart(2, "0")} threads
        </span>
      </header>

      {/* Ask a question */}
      <form action={askQuestion} className="panel rule-top mt-6 p-5">
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="slug" value={slug} />
        <label className="eyebrow eyebrow-muted">Ask the instructor</label>
        <textarea
          name="body"
          rows={2}
          required
          minLength={3}
          placeholder="Ask a question about this course…"
          className="field mt-2 w-full"
        />
        <div className="mt-3 flex justify-end">
          <button type="submit" className="btn btn-primary btn-sm">
            Post question
          </button>
        </div>
      </form>

      {/* Threads */}
      <div className="mt-6 space-y-4">
        {questions.length === 0 ? (
          <p className="panel px-6 py-8 text-muted">
            No questions yet. Be the first to ask.
          </p>
        ) : (
          questions.map((q) => {
            const canToggle = isAdmin || q.authorId === viewerId;
            return (
              <div key={q.id} className="panel rule-top p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] text-foreground">{q.body}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted">
                      {q.author.name} · {fmt(q.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                      q.resolved
                        ? "border-success/40 text-success bg-[rgba(74,222,128,0.08)]"
                        : "border-gold/40 text-gold bg-[rgba(244,162,97,0.08)]"
                    }`}
                  >
                    {q.resolved ? "Resolved" : "Open"}
                  </span>
                </div>

                {/* Answers */}
                {q.answers.length > 0 ? (
                  <div className="mt-4 space-y-3 border-l border-border pl-4">
                    {q.answers.map((a) => (
                      <div key={a.id}>
                        <p className="text-[14px] text-foreground">{a.body}</p>
                        <p className="mt-1 flex items-center gap-2 font-mono text-[11px] text-muted">
                          <span>{a.author.name}</span>
                          {a.staff ? (
                            <span className="border border-accent-bright/40 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-accent-bright">
                              Instructor
                            </span>
                          ) : null}
                          <span>· {fmt(a.createdAt)}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Reply + resolve controls */}
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <form action={answerQuestion} className="flex-1">
                    <input type="hidden" name="questionId" value={q.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <div className="flex gap-2">
                      <input
                        name="body"
                        required
                        placeholder={isAdmin ? "Answer as instructor…" : "Reply…"}
                        className="field flex-1"
                      />
                      <button type="submit" className="btn btn-ghost btn-sm">
                        Reply
                      </button>
                    </div>
                  </form>
                  {canToggle ? (
                    <form action={setQuestionResolved}>
                      <input type="hidden" name="questionId" value={q.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="resolved" value={(!q.resolved).toString()} />
                      <button type="submit" className="btn btn-ghost btn-sm">
                        {q.resolved ? "Reopen" : "Mark resolved"}
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
