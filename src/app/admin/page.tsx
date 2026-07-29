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
