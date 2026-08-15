import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface QueueItem {
  key: string;
  href: string;
  name: string;
  agency: string;
  subtitle: string;
  submittedAt: Date;
}

export default async function AdminGradingPage() {
  const [pendingAttempts, pendingSubmissions] = await Promise.all([
    prisma.attempt.findMany({
      where: { status: "PENDING_GRADING" },
      orderBy: { submittedAt: "asc" },
      include: {
        user: true,
        quiz: { include: { unit: { include: { section: { include: { course: true } } } } } },
      },
    }),
    prisma.assignmentSubmission.findMany({
      where: { status: "PENDING_GRADING" },
      orderBy: { submittedAt: "asc" },
      include: {
        user: true,
        unit: { include: { section: { include: { course: true } } } },
      },
    }),
  ]);

  // Merge the two pending queues into one list, oldest first.
  const queue: QueueItem[] = [
    ...pendingAttempts.map((a) => ({
      key: `attempt:${a.id}`,
      href: `/admin/grading/${a.id}`,
      name: a.user.name,
      agency: a.user.agency,
      subtitle: `${a.quiz.unit.section.course.title} — ${a.quiz.title}`,
      submittedAt: a.submittedAt,
    })),
    ...pendingSubmissions.map((s) => ({
      key: `submission:${s.id}`,
      href: `/admin/grading/submission/${s.id}`,
      name: s.user.name,
      agency: s.user.agency,
      subtitle: `${s.unit.section.course.title} — ${s.unit.title}`,
      submittedAt: s.submittedAt,
    })),
  ].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());

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
    <div className="reveal">
      <p className="eyebrow eyebrow-gold">// GRADING QUEUE</p>
      <h1 className="display-lg mt-2 text-foreground">Grading</h1>
      <p className="mt-2 text-[15px] text-muted">
        Document-upload answers await manual grading. Multiple-choice is scored
        automatically.
      </p>

      <section className="mt-6">
        <p className="eyebrow eyebrow-muted">
          Awaiting grading ({queue.length})
        </p>
        {queue.length === 0 ? (
          <p className="panel mt-3 px-4 py-6 text-[15px] text-muted">
            Nothing to grade right now.
          </p>
        ) : (
          <ul className="panel mt-3 divide-y divide-border overflow-hidden">
            {queue.map((a) => (
              <li key={a.key}>
                <Link
                  href={a.href}
                  className="flex items-center gap-4 px-4 py-3 transition hover:bg-[rgba(0,180,216,0.04)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] text-foreground">{a.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted">
                      {a.agency} · {a.subtitle}
                    </p>
                  </div>
                  <span className="hidden shrink-0 font-mono text-[11px] text-muted sm:block">
                    {a.submittedAt.toLocaleDateString()}
                  </span>
                  <span className="btn btn-primary btn-sm shrink-0">
                    Grade →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <p className="eyebrow eyebrow-muted">
          Recently graded
        </p>
        {recent.length === 0 ? (
          <p className="mt-3 text-[15px] text-muted">No graded attempts yet.</p>
        ) : (
          <ul className="panel mt-3 divide-y divide-border overflow-hidden">
            {recent.map((a) => (
              <li key={a.id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] text-foreground">{a.user.name}</p>
                  <p className="truncate font-mono text-[11px] text-muted">{a.quiz.title}</p>
                </div>
                <span className="shrink-0 font-mono text-[13px] text-foreground">{a.score}%</span>
                <span
                  className={`inline-block shrink-0 border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                    a.passed
                      ? "border-success/40 text-success bg-[rgba(74,222,128,0.08)]"
                      : "border-danger/40 text-danger bg-[rgba(239,68,68,0.08)]"
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
