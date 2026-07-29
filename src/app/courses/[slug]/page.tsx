import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/site-header";
import {
  loadCourseBySlug,
  flattenUnits,
  progressMap,
  percentComplete,
  UNIT_ICON,
} from "@/lib/course";
import { UNIT_LABEL } from "@/lib/units";
import { enroll } from "../actions";

export const dynamic = "force-dynamic";

export default async function CourseOverview({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  const user = session!.user;

  const course = await loadCourseBySlug(slug);
  if (!course) notFound();

  const isAdmin = user.role === "ADMIN";
  // Non-admins can only view published courses.
  if (course.status !== "PUBLISHED" && !isAdmin) redirect("/dashboard");

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
  });

  const completed = enrollment ? await progressMap(user.id, course) : new Set<string>();
  const pct = percentComplete(course, completed);
  const units = flattenUnits(course);
  const firstUnit = units[0];

  return (
    <div className="min-h-screen">
      <SiteHeader name={user.name} isAdmin={isAdmin} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href="/dashboard" className="text-sm text-accent hover:underline">
          ← Back to my training
        </Link>

        <div className="mt-4 rounded-xl border border-border bg-surface p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              {course.category ? (
                <span className="text-xs font-medium uppercase tracking-wide text-accent">
                  {course.category.name}
                </span>
              ) : null}
              <h1 className="mt-1 text-2xl font-semibold text-foreground">
                {course.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted">
                {course.description || "No description provided."}
              </p>
            </div>
            {course.status !== "PUBLISHED" ? (
              <span className="rounded-full border border-warning/40 px-2.5 py-0.5 text-xs text-warning">
                {course.status} (admin preview)
              </span>
            ) : null}
          </div>

          <div className="mt-6">
            {enrollment ? (
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-[180px] flex-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted">{pct}% complete</p>
                </div>
                {firstUnit ? (
                  <Link
                    href={`/courses/${slug}/units/${firstUnit.id}`}
                    className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-[#04212b] hover:bg-accent-strong"
                  >
                    {pct > 0 ? "Continue" : "Start course"}
                  </Link>
                ) : null}
              </div>
            ) : course.status === "PUBLISHED" ? (
              <form action={enroll}>
                <input type="hidden" name="slug" value={slug} />
                <button className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-[#04212b] hover:bg-accent-strong">
                  Enroll
                </button>
              </form>
            ) : (
              <p className="text-sm text-muted">Publish this course to allow enrollment.</p>
            )}
          </div>
        </div>

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Curriculum
          </h2>
          <div className="mt-3 space-y-5">
            {course.sections.length === 0 ? (
              <p className="rounded-lg border border-border bg-surface px-4 py-6 text-sm text-muted">
                No content yet.
              </p>
            ) : (
              course.sections.map((section) => (
                <div key={section.id}>
                  <h3 className="text-sm font-semibold text-foreground">
                    {section.title}
                  </h3>
                  <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                    {section.units.map((u) => {
                      const done = completed.has(u.id);
                      const row = (
                        <div className="flex items-center gap-3 px-4 py-3">
                          <span className="text-muted">{UNIT_ICON[u.type]}</span>
                          <span className="flex-1 text-sm text-foreground">{u.title}</span>
                          <span className="text-xs text-muted">{UNIT_LABEL[u.type]}</span>
                          {done ? (
                            <span className="text-xs text-success">✓ Done</span>
                          ) : null}
                        </div>
                      );
                      return (
                        <li key={u.id}>
                          {enrollment ? (
                            <Link
                              href={`/courses/${slug}/units/${u.id}`}
                              className="block hover:bg-surface-2"
                            >
                              {row}
                            </Link>
                          ) : (
                            row
                          )}
                        </li>
                      );
                    })}
                    {section.units.length === 0 ? (
                      <li className="px-4 py-3 text-sm text-muted">No units.</li>
                    ) : null}
                  </ul>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
