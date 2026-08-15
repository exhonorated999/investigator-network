import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { gradeSubmission } from "../../actions";

export const dynamic = "force-dynamic";

export default async function GradeSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id },
    include: {
      user: true,
      file: true,
      unit: { include: { section: { include: { course: true } } } },
    },
  });
  if (!submission) notFound();

  const prompt = String(
    (submission.unit.data as Record<string, unknown>)?.prompt || ""
  );

  // Prior submissions for this learner + unit, newest first, for context.
  const history = await prisma.assignmentSubmission.findMany({
    where: { userId: submission.userId, unitId: submission.unitId },
    orderBy: { submittedAt: "desc" },
    include: { file: true },
  });

  return (
    <div className="reveal max-w-3xl">
      <Link
        href="/admin/grading"
        className="eyebrow eyebrow-muted transition hover:text-accent-bright"
      >
        ← Back to grading queue
      </Link>

      <h1 className="display-lg mt-3 text-foreground">Grade exercise</h1>
      <p className="mt-2 font-mono text-[12px] text-muted">
        {submission.user.name} · {submission.user.agency} —{" "}
        {submission.unit.section.course.title} / {submission.unit.title}
      </p>

      {prompt ? (
        <div className="panel mt-6 p-5">
          <p className="eyebrow eyebrow-muted">Assignment</p>
          <p className="mt-2 whitespace-pre-wrap text-[15px] text-muted">{prompt}</p>
        </div>
      ) : null}

      <div className="panel mt-4 p-5">
        <p className="eyebrow eyebrow-muted">Submitted file</p>
        {submission.file ? (
          <a
            href={`/api/files/${submission.file.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm mt-3"
          >
            ↓ {submission.file.filename}
          </a>
        ) : (
          <p className="mt-3 text-[14px] text-danger">No file on this submission.</p>
        )}
        <p className="mt-3 font-mono text-[11px] text-muted">
          Submitted {submission.submittedAt.toLocaleString()}
        </p>
      </div>

      <form action={gradeSubmission} className="mt-6 space-y-4">
        <input type="hidden" name="submissionId" value={submission.id} />
        <label className="grid gap-1.5">
          <span className="eyebrow eyebrow-muted">Feedback (optional)</span>
          <textarea
            name="feedback"
            defaultValue={submission.feedback ?? ""}
            rows={3}
            className="field"
            placeholder="Notes shown to the learner (especially useful on a fail)."
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button name="decision" value="pass" className="btn btn-primary">
            ✓ Pass
          </button>
          <button name="decision" value="fail" className="btn btn-ghost">
            ✕ Fail (allow resubmit)
          </button>
        </div>
      </form>

      {history.length > 1 ? (
        <section className="mt-10">
          <p className="eyebrow eyebrow-muted">Submission history</p>
          <ul className="panel mt-3 divide-y divide-border overflow-hidden">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-muted">
                  {h.file?.filename ?? "—"}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted">
                  {h.submittedAt.toLocaleDateString()}
                </span>
                <span
                  className={`shrink-0 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
                    h.status === "PASSED"
                      ? "border-success/40 text-success"
                      : h.status === "FAILED"
                        ? "border-danger/40 text-danger"
                        : "border-border text-muted"
                  }`}
                >
                  {h.status === "PENDING_GRADING" ? "Pending" : h.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
