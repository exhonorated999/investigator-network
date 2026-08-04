import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Sparkline } from "@/components/charts";
import { getOnlineUsers, countOnline } from "@/lib/presence";
import { getSignupCounts, getSignupSeries } from "@/lib/analytics";
import { loadOpenQuestions, countOpenQuestions } from "@/lib/course-forum";
import { answerQuestion } from "@/app/courses/[slug]/forum-actions";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [
    pending,
    learners,
    publishedCourses,
    courses,
    enrollments,
    certificates,
    pendingGrading,
    gradedAttempts,
    passedAttempts,
    hiddenPosts,
    hiddenComments,
    openQuestionCount,
  ] = await Promise.all([
    prisma.user.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { role: "LEARNER", status: "APPROVED" } }),
    prisma.course.count({ where: { status: "PUBLISHED" } }),
    prisma.course.count(),
    prisma.enrollment.count(),
    prisma.certificate.count(),
    prisma.attempt.count({ where: { status: "PENDING_GRADING" } }),
    prisma.attempt.count({ where: { status: "GRADED" } }),
    prisma.attempt.count({ where: { status: "GRADED", passed: true } }),
    prisma.post.count({ where: { hidden: true } }),
    prisma.postComment.count({ where: { hidden: true } }),
    countOpenQuestions(),
  ]);

  const passRate =
    gradedAttempts > 0 ? Math.round((passedAttempts / gradedAttempts) * 100) : null;
  const hidden = hiddenPosts + hiddenComments;

  const [onlineCount, onlineUsers, signups, signupSeries, submissions, openQuestions] =
    await Promise.all([
      countOnline(),
      getOnlineUsers(6),
      getSignupCounts(),
      getSignupSeries(14),
      prisma.attempt.findMany({
        where: { status: "PENDING_GRADING" },
        orderBy: { submittedAt: "asc" },
        take: 6,
        select: {
          id: true,
          submittedAt: true,
          user: { select: { name: true } },
          quiz: {
            select: {
              title: true,
              unit: {
                select: {
                  section: { select: { course: { select: { title: true } } } },
                },
              },
            },
          },
        },
      }),
      loadOpenQuestions(6),
    ]);

  // Unified recent-activity timeline — three sources merged and sorted so the
  // admin sees one clean feed instead of three near-empty boxes.
  const [recentUsers, recentEnrollments, recentCerts] = await Promise.all([
    prisma.user.findMany({
      where: { status: { not: "REMOVED" } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, agency: true, createdAt: true },
    }),
    prisma.enrollment.findMany({
      orderBy: { enrolledAt: "desc" },
      take: 6,
      select: {
        id: true,
        enrolledAt: true,
        user: { select: { name: true } },
        course: { select: { title: true } },
      },
    }),
    prisma.certificate.findMany({
      orderBy: { issuedAt: "desc" },
      take: 6,
      select: {
        id: true,
        issuedAt: true,
        user: { select: { name: true } },
        course: { select: { title: true } },
      },
    }),
  ]);

  type Activity = { key: string; date: Date; main: string; sub: string; tag: string };
  const activity: Activity[] = [
    ...recentUsers.map((u) => ({
      key: `u-${u.id}`,
      date: u.createdAt,
      main: u.name,
      sub: u.agency || "New registration",
      tag: "JOINED",
    })),
    ...recentEnrollments.map((e) => ({
      key: `e-${e.id}`,
      date: e.enrolledAt,
      main: e.user.name,
      sub: e.course.title,
      tag: "ENROLLED",
    })),
    ...recentCerts.map((c) => ({
      key: `c-${c.id}`,
      date: c.issuedAt,
      main: c.user.name,
      sub: c.course.title,
      tag: "CERTIFIED",
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 8);

  const kpis = [
    { label: "Approved learners", value: learners, href: "/admin/users?status=APPROVED" },
    { label: "Published courses", value: `${publishedCourses}/${courses}`, href: "/admin/courses" },
    { label: "Enrollments", value: enrollments, href: "/admin/courses" },
    { label: "Certificates", value: certificates, href: "/admin/courses" },
  ];

  const hasWork = pending > 0 || pendingGrading > 0 || hidden > 0 || openQuestionCount > 0;

  return (
    <div className="reveal">
      <p className="eyebrow eyebrow-gold">// OPS DASHBOARD</p>
      <h1 className="display-lg mt-2 text-foreground">Command Center</h1>
      <p className="mt-2 text-[15px] text-muted">
        Everything that needs you, and the pulse of the platform — at a glance.
      </p>

      {/* ---- Needs you: one actionable strip ---- */}
      <section className="mt-8">
        <p className="eyebrow eyebrow-muted">Needs you</p>
        {hasWork ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ActionTile
              show={pending > 0}
              href="/admin/users?status=PENDING"
              value={pending}
              label={pending === 1 ? "person awaiting access" : "people awaiting access"}
              tone="gold"
            />
            <ActionTile
              show={pendingGrading > 0}
              href="/admin/grading"
              value={pendingGrading}
              label={pendingGrading === 1 ? "attempt to grade" : "attempts to grade"}
              tone="cyan"
            />
            <ActionTile
              show={openQuestionCount > 0}
              href="#course-questions"
              value={openQuestionCount}
              label={openQuestionCount === 1 ? "course question" : "course questions"}
              tone="cyan"
            />
            <ActionTile
              show={hidden > 0}
              href="/admin/moderation"
              value={hidden}
              label={hidden === 1 ? "hidden item to review" : "hidden items to review"}
              tone="danger"
            />
          </div>
        ) : (
          <div className="panel rule-top rule-top-gold mt-3 flex items-center gap-3 px-5 py-4">
            <span className="relative flex h-2.5 w-2.5">
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            <p className="text-[15px] text-foreground">
              All clear — no approvals, grading, or moderation waiting.
            </p>
          </div>
        )}
      </section>

      {/* ---- KPIs ---- */}
      <section className="mt-8">
        <p className="eyebrow eyebrow-muted">At a glance</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((s, i) => (
            <Link
              key={s.label}
              href={s.href}
              className={`panel panel-hover rule-top px-5 py-5 transition reveal reveal-${Math.min(
                i + 1,
                5
              )}`}
            >
              <p className="font-display text-4xl font-black leading-none text-accent-bright">
                {s.value}
              </p>
              <p className="eyebrow eyebrow-muted mt-2">{s.label}</p>
            </Link>
          ))}
        </div>

        {/* Pass-rate bar — a visual read on quiz outcomes */}
        <div className="panel rule-top mt-3 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow eyebrow-muted">Test pass rate</p>
            <p className="font-display text-lg font-black text-foreground">
              {passRate == null ? "—" : `${passRate}%`}
            </p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[rgba(136,153,170,0.14)]">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${passRate ?? 0}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted">
            {gradedAttempts} graded attempt{gradedAttempts === 1 ? "" : "s"}
          </p>
        </div>
      </section>

      {/* ---- Pulse: live + growth ---- */}
      <section className="mt-8">
        <p className="eyebrow eyebrow-muted">Pulse</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {/* Who's online */}
          <div className="panel rule-top p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow eyebrow-gold">Live</p>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="relative flex h-2.5 w-2.5">
                    {onlineCount > 0 ? (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                    ) : null}
                    <span
                      className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                        onlineCount > 0 ? "bg-success" : "bg-border-strong"
                      }`}
                    />
                  </span>
                  <span className="display-lg text-foreground">{onlineCount}</span>
                  <span className="eyebrow eyebrow-muted">Online now</span>
                </div>
              </div>
              <Link href="/admin/analytics" className="btn btn-ghost btn-sm">
                Analytics →
              </Link>
            </div>

            <div className="mt-4 divide-y divide-border">
              {onlineUsers.length === 0 ? (
                <Empty />
              ) : (
                onlineUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        u.idle ? "bg-gold" : "bg-success"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] text-foreground">{u.name}</p>
                      <p className="truncate font-mono text-[11px] text-muted">
                        {u.courseTitle
                          ? u.unitTitle
                            ? `${u.courseTitle} — ${u.unitTitle}`
                            : u.courseTitle
                          : u.path ?? "—"}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                      {u.idle ? "idle" : "active"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Growth snapshot */}
          <div className="panel rule-top p-5">
            <p className="eyebrow eyebrow-gold">Growth</p>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              {(["week", "month", "quarter", "year"] as const).map((p) => (
                <div key={p}>
                  <p className="font-display text-2xl font-black leading-none text-accent-bright">
                    {signups[p]}
                  </p>
                  <p className="eyebrow eyebrow-muted mt-1 text-[8px]">{p}</p>
                </div>
              ))}
            </div>
            <p className="eyebrow eyebrow-muted mt-5">New signups — last 14 days</p>
            <div className="mt-3">
              <Sparkline
                points={signupSeries.map((s) => s.value)}
                label="Daily signups over the last 14 days"
                height={64}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---- Queue + activity ---- */}
      <section className="mt-8">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Grading queue */}
          <div className="panel rule-top p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow eyebrow-gold">Grading queue</p>
              {pendingGrading > 0 ? (
                <span className="border border-gold/40 bg-[rgba(244,162,97,0.08)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
                  {pendingGrading} waiting
                </span>
              ) : null}
            </div>

            <div className="mt-4 divide-y divide-border">
              {submissions.length === 0 ? (
                <p className="py-3 text-sm text-muted">Nothing awaiting a grade.</p>
              ) : (
                submissions.map((a) => (
                  <Link
                    key={a.id}
                    href={`/admin/grading/${a.id}`}
                    className="flex items-center gap-3 py-2.5 transition hover:text-accent-bright"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] text-foreground">{a.user.name}</p>
                      <p className="truncate font-mono text-[11px] text-muted">
                        {a.quiz.unit.section.course.title} / {a.quiz.title}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-gold">
                      {relTime(a.submittedAt)}
                    </span>
                  </Link>
                ))
              )}
            </div>

            {pendingGrading > 0 ? (
              <Link href="/admin/grading" className="btn btn-primary btn-sm mt-4">
                Grade {pendingGrading} {pendingGrading === 1 ? "attempt" : "attempts"} →
              </Link>
            ) : null}
          </div>

          {/* Recent activity — merged timeline */}
          <div className="panel rule-top p-5">
            <p className="eyebrow eyebrow-gold">Recent activity</p>
            <div className="mt-4 divide-y divide-border">
              {activity.length === 0 ? (
                <Empty />
              ) : (
                activity.map((a) => (
                  <div key={a.key} className="flex items-center gap-3 py-2.5">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        a.tag === "CERTIFIED"
                          ? "bg-success"
                          : a.tag === "ENROLLED"
                          ? "bg-accent-bright"
                          : "bg-gold"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] text-foreground">{a.main}</p>
                      <p className="truncate font-mono text-[11px] text-muted">{a.sub}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                      {a.tag} · {relTime(a.date)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---- Course questions: answer inline ---- */}
      <section id="course-questions" className="mt-8 scroll-mt-24">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow eyebrow-muted">Course questions</p>
          {openQuestionCount > 0 ? (
            <span className="border border-gold/40 bg-[rgba(244,162,97,0.08)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
              {openQuestionCount} open
            </span>
          ) : null}
        </div>
        <div className="panel rule-top mt-3 p-5">
          {openQuestions.length === 0 ? (
            <p className="py-3 text-sm text-muted">
              No open questions. Learner questions from any course appear here to answer.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {openQuestions.map((q) => (
                <div key={q.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] text-foreground">{q.body}</p>
                      <p className="mt-1 font-mono text-[11px] text-muted">
                        {q.author.name} · {q.course.title} · {relTime(q.createdAt)}
                      </p>
                    </div>
                    <Link
                      href={`/courses/${q.course.slug}`}
                      className="btn btn-ghost btn-sm shrink-0"
                    >
                      Open →
                    </Link>
                  </div>

                  {q.answers.length > 0 ? (
                    <div className="mt-3 space-y-2 border-l border-border pl-3">
                      {q.answers.map((a) => (
                        <p key={a.id} className="text-[13px] text-muted">
                          <span className="text-foreground">{a.author.name}:</span>{" "}
                          {a.body}
                        </p>
                      ))}
                    </div>
                  ) : null}

                  <form action={answerQuestion} className="mt-3 flex gap-2">
                    <input type="hidden" name="questionId" value={q.id} />
                    <input type="hidden" name="slug" value={q.course.slug} />
                    <input
                      name="body"
                      required
                      placeholder="Answer as instructor…"
                      className="field flex-1"
                    />
                    <button type="submit" className="btn btn-primary btn-sm">
                      Answer
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ActionTile({
  show,
  href,
  value,
  label,
  tone,
}: {
  show: boolean;
  href: string;
  value: number;
  label: string;
  tone: "gold" | "cyan" | "danger";
}) {
  if (!show) return null;
  const toneClass =
    tone === "gold"
      ? "rule-top-gold text-gold"
      : tone === "danger"
      ? "text-danger"
      : "text-accent-bright";
  return (
    <Link
      href={href}
      className={`panel panel-hover rule-top glow-ring px-5 py-4 transition ${toneClass}`}
    >
      <p className="font-display text-3xl font-black leading-none">{value}</p>
      <p className="eyebrow eyebrow-muted mt-2">{label} →</p>
    </Link>
  );
}

function Empty() {
  return <p className="py-3 text-sm text-muted">Nothing yet.</p>;
}

/** Compact relative time ("3m", "2h", "5d") for dense dashboard rows. */
function relTime(d: Date): string {
  const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (secs < 60) return "now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}
