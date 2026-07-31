import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Sparkline } from "@/components/charts";
import { getOnlineUsers, countOnline } from "@/lib/presence";
import { getSignupCounts, getSignupSeries } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [
    pending,
    learners,
    courses,
    publishedCourses,
    enrollments,
    completions,
    certificates,
    pendingGrading,
    gradedAttempts,
    passedAttempts,
  ] = await Promise.all([
    prisma.user.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { role: "LEARNER", status: "APPROVED" } }),
    prisma.course.count(),
    prisma.course.count({ where: { status: "PUBLISHED" } }),
    prisma.enrollment.count(),
    prisma.unitProgress.count({ where: { status: "COMPLETE" } }),
    prisma.certificate.count(),
    prisma.attempt.count({ where: { status: "PENDING_GRADING" } }),
    prisma.attempt.count({ where: { status: "GRADED" } }),
    prisma.attempt.count({ where: { status: "GRADED", passed: true } }),
  ]);

  const passRate = gradedAttempts > 0 ? Math.round((passedAttempts / gradedAttempts) * 100) : null;

  const [recentUsers, recentEnrollments, recentCerts] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, agency: true, status: true, createdAt: true },
    }),
    prisma.enrollment.findMany({
      orderBy: { enrolledAt: "desc" },
      take: 5,
      include: { user: { select: { name: true } }, course: { select: { title: true } } },
    }),
    prisma.certificate.findMany({
      orderBy: { issuedAt: "desc" },
      take: 5,
      include: { user: { select: { name: true } }, course: { select: { title: true } } },
    }),
  ]);

  const [
    onlineCount,
    onlineUsers,
    signups,
    signupSeries,
    submissions,
    recentMessages,
    unreadishConvos,
    hiddenPosts,
    hiddenComments,
    recentPosts,
  ] = await Promise.all([
    countOnline(),
    getOnlineUsers(6),
    getSignupCounts(),
    getSignupSeries(14),
    // Quiz/test submissions waiting on a human grade.
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
                id: true,
                title: true,
                section: { select: { course: { select: { title: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.message.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        body: true,
        createdAt: true,
        conversationId: true,
        sender: { select: { name: true } },
      },
    }),
    prisma.conversation.count(),
    prisma.post.count({ where: { hidden: true } }),
    prisma.postComment.count({ where: { hidden: true } }),
    prisma.post.findMany({
      where: { hidden: false },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        topic: true,
        body: true,
        createdAt: true,
        author: { select: { name: true } },
        _count: { select: { comments: true } },
      },
    }),
  ]);

  const stats = [
    { label: "Pending approvals", value: pending, href: "/admin/users?status=PENDING", accent: true },
    { label: "To grade", value: pendingGrading, href: "/admin/grading", accent: true },
    { label: "Approved learners", value: learners, href: "/admin/users?status=APPROVED" },
    { label: "Published courses", value: `${publishedCourses}/${courses}`, href: "/admin/courses" },
    { label: "Enrollments", value: enrollments, href: "/admin/courses" },
    { label: "Certificates issued", value: certificates, href: "/admin/courses" },
    { label: "Units completed", value: completions, href: "/admin/courses" },
    { label: "Test pass rate", value: passRate == null ? "—" : `${passRate}%`, href: "/admin/grading" },
  ];

  return (
    <div className="reveal">
      <p className="eyebrow eyebrow-gold">// OPS DASHBOARD</p>
      <h1 className="display-lg mt-2 text-foreground">Command Center</h1>
      <p className="mt-2 text-[15px] text-muted">
        Approvals, courses, grading, and platform activity at a glance.
      </p>

      {/* Stat tiles */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => {
          const highlight = s.accent && Number(s.value) > 0;
          return (
            <Link
              key={s.label}
              href={s.href}
              className={`panel panel-hover rule-top px-5 py-4 transition ${
                highlight ? "rule-top-gold glow-ring" : ""
              } reveal reveal-${Math.min(i + 1, 5)}`}
            >
              <p
                className={`font-display text-3xl font-black leading-none ${
                  highlight ? "text-gold" : "text-accent-bright"
                }`}
              >
                {s.value}
              </p>
              <p className="eyebrow eyebrow-muted mt-2">{s.label}</p>
            </Link>
          );
        })}
      </div>

      {/* Action banners */}
      {(pending > 0 || pendingGrading > 0) && (
        <div className="mt-6 flex flex-wrap gap-3">
          {pending > 0 && (
            <Link
              href="/admin/users?status=PENDING"
              className="btn btn-gold btn-sm"
            >
              {pending} {pending === 1 ? "person" : "people"} awaiting access →
            </Link>
          )}
          {pendingGrading > 0 && (
            <Link
              href="/admin/grading"
              className="btn btn-primary btn-sm"
            >
              {pendingGrading} {pendingGrading === 1 ? "attempt" : "attempts"} to grade →
            </Link>
          )}
        </div>
      )}

      {/* Live + growth strip */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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
                        : (u.path ?? "—")}
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

      {/* Review queues */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Submissions to grade */}
        <div className="panel rule-top p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow eyebrow-gold">Needs review</p>
            {pendingGrading > 0 ? (
              <span className="border border-gold/40 bg-[rgba(244,162,97,0.08)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
                {pendingGrading} new
              </span>
            ) : null}
          </div>
          <h2 className="display-sm mt-2 text-foreground">Test submissions</h2>

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
                    <p className="truncate text-[15px] text-foreground">
                      {a.user.name}
                    </p>
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

        {/* Messages */}
        <div className="panel rule-top p-5">
          <p className="eyebrow eyebrow-gold">Inbox</p>
          <h2 className="display-sm mt-2 text-foreground">Recent messages</h2>
          <p className="mt-1 font-mono text-[11px] text-muted">
            {unreadishConvos} conversation{unreadishConvos === 1 ? "" : "s"} total
          </p>

          <div className="mt-4 divide-y divide-border">
            {recentMessages.length === 0 ? (
              <p className="py-3 text-sm text-muted">No messages yet.</p>
            ) : (
              recentMessages.map((m) => (
                <div key={m.id} className="py-2.5">
                  <div className="flex items-center gap-3">
                    <p className="min-w-0 flex-1 truncate text-[15px] text-foreground">
                      {m.sender.name}
                    </p>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                      {relTime(m.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted">
                    {m.body}
                  </p>
                </div>
              ))
            )}
          </div>

          <Link href="/messages" className="btn btn-ghost btn-sm mt-4">
            Open inbox →
          </Link>
        </div>

        {/* Feed moderation */}
        <div className="panel rule-top p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow eyebrow-gold">Moderation</p>
            {hiddenPosts + hiddenComments > 0 ? (
              <span className="border border-danger/40 bg-[rgba(239,68,68,0.08)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-danger">
                {hiddenPosts + hiddenComments} hidden
              </span>
            ) : null}
          </div>
          <h2 className="display-sm mt-2 text-foreground">Social feed</h2>

          <div className="mt-4 divide-y divide-border">
            {recentPosts.length === 0 ? (
              <p className="py-3 text-sm text-muted">No posts yet.</p>
            ) : (
              recentPosts.map((p) => (
                <div key={p.id} className="py-2.5">
                  <div className="flex items-center gap-3">
                    <p className="min-w-0 flex-1 truncate text-[15px] text-foreground">
                      {p.author.name}
                    </p>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-accent-bright">
                      {p.topic}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted">
                    {p.body}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                    {p._count.comments} comment
                    {p._count.comments === 1 ? "" : "s"} · {relTime(p.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>

          <Link href="/admin/moderation" className="btn btn-ghost btn-sm mt-4">
            Moderate feed →
          </Link>
        </div>
      </div>

      {/* Activity feeds */}
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <ActivityCard title="Newest users" label="01 / Registrations">
          {recentUsers.length === 0 ? (
            <Empty />
          ) : (
            recentUsers.map((u) => (
              <Row key={u.id} main={u.name} sub={u.agency} tag={u.status} />
            ))
          )}
        </ActivityCard>

        <ActivityCard title="Recent enrollments" label="02 / Enrollments">
          {recentEnrollments.length === 0 ? (
            <Empty />
          ) : (
            recentEnrollments.map((e) => (
              <Row key={e.id} main={e.user.name} sub={e.course.title} />
            ))
          )}
        </ActivityCard>

        <ActivityCard title="Certificates issued" label="03 / Credentials">
          {recentCerts.length === 0 ? (
            <Empty />
          ) : (
            recentCerts.map((c) => (
              <Row key={c.id} main={c.user.name} sub={c.course.title} tag="CERT" />
            ))
          )}
        </ActivityCard>
      </div>
    </div>
  );
}

function ActivityCard({
  title,
  label,
  children,
}: {
  title: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel rule-top p-5">
      <p className="eyebrow eyebrow-gold">{label}</p>
      <h2 className="display-sm mt-2 text-foreground">{title}</h2>
      <div className="mt-4 divide-y divide-border">{children}</div>
    </div>
  );
}

function Row({ main, sub, tag }: { main: string; sub?: string; tag?: string }) {
  const tagColor =
    tag === "PENDING"
      ? "text-gold"
      : tag === "APPROVED"
        ? "text-success"
        : tag === "DENIED" || tag === "SUSPENDED"
          ? "text-danger"
          : "text-accent-bright";
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] text-foreground">{main}</p>
        {sub ? <p className="truncate font-mono text-[11px] text-muted">{sub}</p> : null}
      </div>
      {tag ? (
        <span className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] ${tagColor}`}>
          {tag}
        </span>
      ) : null}
    </div>
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
