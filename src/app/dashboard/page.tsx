import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className="h-full rounded-full bg-accent transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const user = session!.user;
  const isAdmin = user.role === "ADMIN";

  // Enrolled courses with unit counts.
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    orderBy: { enrolledAt: "desc" },
    include: {
      course: {
        include: {
          category: true,
          sections: { include: { units: { select: { id: true } } } },
        },
      },
    },
  });

  const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));

  // Completed-unit counts for this user across enrolled courses.
  const allUnitIds = enrollments.flatMap((e) =>
    e.course.sections.flatMap((s) => s.units.map((u) => u.id))
  );
  const completed = allUnitIds.length
    ? await prisma.unitProgress.findMany({
        where: { userId: user.id, unitId: { in: allUnitIds }, status: "COMPLETE" },
        select: { unitId: true },
      })
    : [];
  const completedSet = new Set(completed.map((c) => c.unitId));

  // Available published courses not yet enrolled.
  const available = await prisma.course.findMany({
    where: { status: "PUBLISHED", id: { notIn: [...enrolledCourseIds] } },
    orderBy: { updatedAt: "desc" },
    include: { category: true, sections: { include: { units: { select: { id: true } } } } },
  });

  return (
    <div className="min-h-screen">
      <SiteHeader name={user.name} isAdmin={isAdmin} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome, {user.name?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted">{user.agency}</p>

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            My courses
          </h2>
          {enrollments.length === 0 ? (
            <p className="mt-3 rounded-lg border border-border bg-surface px-4 py-6 text-sm text-muted">
              You are not enrolled in any courses yet. Browse available training below.
            </p>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {enrollments.map((e) => {
                const units = e.course.sections.flatMap((s) => s.units);
                const done = units.filter((u) => completedSet.has(u.id)).length;
                const pct = units.length ? Math.round((done / units.length) * 100) : 0;
                return (
                  <Link
                    key={e.id}
                    href={`/courses/${e.course.slug}`}
                    className="group rounded-xl border border-border bg-surface p-4 transition hover:border-accent/60"
                  >
                    {e.course.category ? (
                      <span className="text-xs font-medium uppercase tracking-wide text-accent">
                        {e.course.category.name}
                      </span>
                    ) : null}
                    <h3 className="mt-1 font-semibold text-foreground group-hover:text-accent">
                      {e.course.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">
                      {e.course.description || "—"}
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                      <ProgressBar pct={pct} />
                      <span className="shrink-0 text-xs text-muted">{pct}%</span>
                    </div>
                    {pct === 100 ? (
                      <p className="mt-2 text-xs font-medium text-gold">🏅 Completed</p>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Available training
          </h2>
          {available.length === 0 ? (
            <p className="mt-3 rounded-lg border border-border bg-surface px-4 py-6 text-sm text-muted">
              No new courses available right now.
            </p>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {available.map((c) => {
                const unitCount = c.sections.reduce((n, s) => n + s.units.length, 0);
                return (
                  <Link
                    key={c.id}
                    href={`/courses/${c.slug}`}
                    className="group rounded-xl border border-border bg-surface p-4 transition hover:border-accent/60"
                  >
                    {c.category ? (
                      <span className="text-xs font-medium uppercase tracking-wide text-accent">
                        {c.category.name}
                      </span>
                    ) : null}
                    <h3 className="mt-1 font-semibold text-foreground group-hover:text-accent">
                      {c.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">
                      {c.description || "—"}
                    </p>
                    <p className="mt-4 text-xs text-muted">{unitCount} units</p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
