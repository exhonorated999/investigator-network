import Link from "next/link";
import { prisma } from "@/lib/prisma";

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
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Admin dashboard</h1>
      <p className="mt-1 text-muted">Approvals, courses, grading, and platform activity.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const highlight = s.accent && Number(s.value) > 0;
          return (
            <Link
              key={s.label}
              href={s.href}
              className={`rounded-2xl border bg-surface p-5 transition hover:border-accent ${
                highlight ? "border-accent/50 ring-1 ring-accent/20" : "border-border"
              }`}
            >
              <div className="text-2xl font-semibold text-foreground">{s.value}</div>
              <div className="mt-1 text-sm text-muted">{s.label}</div>
            </Link>
          );
        })}
      </div>

      {(pending > 0 || pendingGrading > 0) && (
        <div className="mt-6 flex flex-wrap gap-3">
          {pending > 0 && (
            <Link
              href="/admin/users?status=PENDING"
              className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-accent hover:bg-accent/20"
            >
              {pending} {pending === 1 ? "person" : "people"} awaiting access →
            </Link>
          )}
          {pendingGrading > 0 && (
            <Link
              href="/admin/grading"
              className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-accent hover:bg-accent/20"
            >
              {pendingGrading} {pendingGrading === 1 ? "attempt" : "attempts"} to grade →
            </Link>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <ActivityCard title="Newest users">
          {recentUsers.length === 0 ? (
            <Empty />
          ) : (
            recentUsers.map((u) => (
              <Row key={u.id} main={u.name} sub={u.agency} tag={u.status} />
            ))
          )}
        </ActivityCard>

        <ActivityCard title="Recent enrollments">
          {recentEnrollments.length === 0 ? (
            <Empty />
          ) : (
            recentEnrollments.map((e) => (
              <Row key={e.id} main={e.user.name} sub={e.course.title} />
            ))
          )}
        </ActivityCard>

        <ActivityCard title="Certificates issued">
          {recentCerts.length === 0 ? (
            <Empty />
          ) : (
            recentCerts.map((c) => (
              <Row key={c.id} main={c.user.name} sub={c.course.title} tag="🏅" />
            ))
          )}
        </ActivityCard>
      </div>
    </div>
  );
}

function ActivityCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="mt-3 divide-y divide-border">{children}</div>
    </div>
  );
}

function Row({ main, sub, tag }: { main: string; sub?: string; tag?: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{main}</p>
        {sub ? <p className="truncate text-xs text-muted">{sub}</p> : null}
      </div>
      {tag ? <span className="shrink-0 text-xs text-muted">{tag}</span> : null}
    </div>
  );
}

function Empty() {
  return <p className="py-3 text-sm text-muted">Nothing yet.</p>;
}
