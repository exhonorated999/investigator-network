import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminGradingPage() {
  const pending = await prisma.attempt.findMany({
    where: { status: "PENDING_GRADING" },
    orderBy: { submittedAt: "asc" },
    include: {
      user: true,
      quiz: { include: { unit: { include: { section: { include: { course: true } } } } } },
    },
  });

  const recent = await prisma.attempt.findMany({
    where: { status: "GRADED" },
    orderBy: { submittedAt: "desc" },
    take: 10,
    include: {
      user: true,
      quiz: { include: { unit: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Grading</h1>
      <p className="mt-1 text-sm text-muted">
        Document-upload answers await manual grading. Multiple-choice is scored
        automatically.
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Awaiting grading ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="mt-3 rounded-lg border border-border bg-surface px-4 py-6 text-sm text-muted">
            Nothing to grade right now.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {pending.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/admin/grading/${a.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-surface-2"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{a.user.name}</p>
                    <p className="text-xs text-muted">
                      {a.user.agency} · {a.quiz.unit.section.course.title} — {a.quiz.title}
                    </p>
                  </div>
                  <span className="text-xs text-muted">
                    {a.submittedAt.toLocaleDateString()}
                  </span>
                  <span className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-[#04212b]">
                    Grade →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Recently graded
        </h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No graded attempts yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {recent.map((a) => (
              <li key={a.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1">
                  <p className="text-sm text-foreground">{a.user.name}</p>
                  <p className="text-xs text-muted">{a.quiz.title}</p>
                </div>
                <span className="text-sm text-muted">{a.score}%</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs ${
                    a.passed
                      ? "border border-success/40 text-success"
                      : "border border-danger/40 text-danger"
                  }`}
                >
                  {a.passed ? "Passed" : "Not passed"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
