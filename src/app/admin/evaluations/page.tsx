import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { COURSE_EVALUATIONS, STAR_LABELS } from "@/lib/evaluation-config";

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type Answers = Record<string, unknown>;

export default async function EvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const { course: courseParam } = await searchParams;
  const slugs = Object.keys(COURSE_EVALUATIONS);
  const courses = await prisma.course.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, title: true },
    orderBy: { title: "asc" },
  });

  const selected = courses.find((c) => c.slug === courseParam) ?? courses[0];

  if (!selected) {
    return (
      <div className="reveal">
        <p className="eyebrow eyebrow-gold">// COURSE EVALUATIONS</p>
        <h1 className="display-lg mt-2 text-foreground">Course evaluations</h1>
        <p className="mt-4 text-muted">No courses have an evaluation configured.</p>
      </div>
    );
  }

  const config = COURSE_EVALUATIONS[selected.slug];
  const evals = await prisma.courseEvaluation.findMany({
    where: { courseId: selected.id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true, agency: true } } },
  });
  const [enrolled, certified] = await Promise.all([
    prisma.enrollment.count({ where: { courseId: selected.id } }),
    prisma.certificate.count({ where: { courseId: selected.id } }),
  ]);

  const answersOf = (e: (typeof evals)[number]) => (e.answers ?? {}) as Answers;

  const starQs = config.questions.filter((q) => q.kind === "stars");
  const yesnoQs = config.questions.filter((q) => q.kind === "yesno");

  const starStats = starQs.map((q) => {
    const vals = evals
      .map((e) => Number(answersOf(e)[q.id]))
      .filter((n) => n >= 1 && n <= 5);
    const dist = [1, 2, 3, 4, 5].map((n) => vals.filter((v) => v === n).length);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { q, avg, count: vals.length, dist };
  });

  const yesnoStats = yesnoQs.map((q) => {
    const vals = evals
      .map((e) => answersOf(e)[q.id])
      .filter((v) => typeof v === "boolean") as boolean[];
    const yes = vals.filter(Boolean).length;
    return { q, yes, total: vals.length };
  });

  const testimonials = evals.filter((e) => e.testimonialOk && e.testimonial);

  return (
    <div className="reveal">
      <p className="eyebrow eyebrow-gold">// COURSE EVALUATIONS</p>
      <h1 className="display-lg mt-2 text-foreground">Course evaluations</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-muted">
        End-of-course evaluations. Learners must submit one before their
        certificate is issued.
      </p>

      {courses.length > 1 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/admin/evaluations?course=${c.slug}`}
              className={`btn btn-sm ${c.id === selected.id ? "btn-primary" : "btn-ghost"}`}
            >
              {c.title}
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-4 font-display text-lg text-foreground">{selected.title}</p>
      )}

      {/* ---------------------------------------------------------- summary */}
      <div className="mt-5 flex flex-wrap gap-3">
        <Stat label="Responses" value={evals.length} />
        <Stat label="Enrolled" value={enrolled} />
        <Stat label="Certificates" value={certified} />
        {yesnoStats.map((s) => (
          <Stat
            key={s.q.id}
            label={s.q.label.replace(/\?$/, "")}
            value={s.total ? `${Math.round((s.yes / s.total) * 100)}% yes` : "—"}
            sub={s.total ? `${s.yes} of ${s.total}` : undefined}
          />
        ))}
        <Stat label="Testimonials" value={testimonials.length} />
      </div>

      {/* ------------------------------------------------------- star ratings */}
      <section className="mt-8">
        <p className="eyebrow">Ratings</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {starStats.map((s) => (
            <div key={s.q.id} className="panel rule-top p-5">
              <p className="text-[15px] text-foreground">{s.q.label}</p>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="font-display text-3xl font-black text-gold">
                  {s.count ? s.avg.toFixed(2) : "—"}
                </span>
                <span className="text-gold">
                  {s.count ? "★".repeat(Math.round(s.avg)) : ""}
                </span>
                <span className="font-mono text-xs text-muted">
                  {s.count} rating{s.count === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-3 grid gap-1">
                {[5, 4, 3, 2, 1].map((n) => {
                  const c = s.dist[n - 1];
                  const pct = s.count ? (c / s.count) * 100 : 0;
                  return (
                    <div key={n} className="flex items-center gap-2 font-mono text-[11px] text-muted">
                      <span className="w-20">{n}★ {STAR_LABELS[n - 1]}</span>
                      <div className="h-[6px] flex-1 bg-[rgba(255,255,255,0.06)]">
                        <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-6 text-right">{c}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- testimonials */}
      <section className="mt-8">
        <p className="eyebrow">Testimonials (learner agreed — publish without names)</p>
        {testimonials.length === 0 ? (
          <p className="mt-3 text-sm text-muted">None yet.</p>
        ) : (
          <div className="mt-3 grid gap-3">
            {testimonials.map((e) => (
              <blockquote key={e.id} className="panel border-l-2 border-gold p-5">
                <p className="whitespace-pre-line text-[15px] text-foreground">
                  &ldquo;{e.testimonial}&rdquo;
                </p>
                <p className="mt-2 font-mono text-[11px] text-muted">
                  {e.user.name}
                  {e.user.agency ? ` · ${e.user.agency}` : ""} · {formatDate(e.createdAt)}
                </p>
              </blockquote>
            ))}
          </div>
        )}
      </section>

      {/* ----------------------------------------------------- all responses */}
      <section className="mt-8">
        <p className="eyebrow">All responses</p>
        {evals.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No evaluations submitted yet.</p>
        ) : (
          <div className="mt-3 grid gap-3">
            {evals.map((e) => {
              const a = answersOf(e);
              return (
                <details key={e.id} className="panel p-5">
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-foreground">
                        {e.user.name}
                        <span className="ml-2 font-mono text-xs text-muted">
                          {e.user.email}
                          {e.user.agency ? ` · ${e.user.agency}` : ""}
                        </span>
                      </span>
                      <span className="font-mono text-xs text-muted">
                        {starQs
                          .map((q) => `${Number(a[q.id]) || "–"}★`)
                          .join("  ")}
                        {"  ·  "}
                        {formatDate(e.createdAt)}
                      </span>
                    </div>
                  </summary>
                  <dl className="mt-4 grid gap-3 border-t border-border pt-4 text-[14px]">
                    {config.questions.map((q) => {
                      const v = a[q.id];
                      const shown =
                        q.kind === "stars"
                          ? `${Number(v) || "–"} / 5`
                          : q.kind === "yesno"
                            ? v === true
                              ? "Yes"
                              : v === false
                                ? "No"
                                : "—"
                            : String(v ?? "").trim() || "—";
                      return (
                        <div key={q.id}>
                          <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                            {q.label}
                          </dt>
                          <dd className="mt-1 whitespace-pre-line text-foreground">{shown}</dd>
                        </div>
                      );
                    })}
                    {config.testimonial ? (
                      <div>
                        <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                          Testimonial
                        </dt>
                        <dd className="mt-1 whitespace-pre-line text-foreground">
                          {e.testimonialOk ? e.testimonial || "—" : "Declined"}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="panel rule-top px-4 py-3">
      <p className="eyebrow eyebrow-muted">{label}</p>
      <p className="display-sm mt-1 text-gold">{value}</p>
      {sub ? <p className="font-mono text-[11px] text-muted">{sub}</p> : null}
    </div>
  );
}
