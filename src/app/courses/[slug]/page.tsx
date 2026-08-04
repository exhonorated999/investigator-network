import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireViewer } from "@/lib/viewer";
import { SiteHeader } from "@/components/site-header";
import {
  loadCourseBySlug,
  flattenUnits,
  progressMap,
  percentComplete,
  UNIT_ICON,
} from "@/lib/course";
import { UNIT_LABEL } from "@/lib/units";
import { CourseForum } from "@/components/course-forum";
import { loadQuestions } from "@/lib/course-forum";
import { enroll } from "../actions";

export const dynamic = "force-dynamic";

export default async function CourseOverview({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireViewer();

  const course = await loadCourseBySlug(slug);
  if (!course) notFound();

  const isAdmin = user.role === "ADMIN";
  // Non-admins can only view published courses.
  if (course.status !== "PUBLISHED" && !isAdmin) redirect("/dashboard");

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
  });

  // Audience + privacy gating (admins bypass). A learner may only see a course
  // on their own side, unless they've been explicitly enrolled into it. Private
  // courses are invisible unless enrolled.
  if (!isAdmin) {
    const audienceOk = course.audiences.includes(user.audience);
    if ((!audienceOk || course.isPrivate) && !enrollment) notFound();
  }

  const completed = enrollment ? await progressMap(user.id, course) : new Set<string>();
  const pct = percentComplete(course, completed);
  const units = flattenUnits(course);
  const firstUnit = units[0];

  const certificate =
    enrollment && pct === 100
      ? await prisma.certificate.findUnique({
          where: { userId_courseId: { userId: user.id, courseId: course.id } },
        })
      : null;

  const totalUnits = units.length;
  const doneCount = completed.size;

  // Course forum — visible to enrolled learners and admins.
  const canForum = isAdmin || !!enrollment;
  const questions = canForum ? await loadQuestions(course.id) : [];

  return (
    <div className="min-h-screen">
      <SiteHeader name={user.name} isAdmin={isAdmin} />
      <main className="mx-auto max-w-4xl px-5 pb-20 pt-8">
        <Link
          href="/dashboard"
          className="eyebrow eyebrow-muted transition hover:text-accent-bright"
        >
          ← Back to my training
        </Link>

        {/* ----------------------------------------------------------- header */}
        <header className="reveal reveal-1 mt-5">
          <div className="flex items-center gap-3">
            {course.category ? (
              <span className="eyebrow">{course.category.name}</span>
            ) : null}
            {course.status !== "PUBLISHED" ? (
              <span className="tag-chip">
                // {course.status} — ADMIN PREVIEW
              </span>
            ) : null}
          </div>
          <h1 className="display-lg mt-4">
            {course.title}
          </h1>
          {course.description ? (
            <p className="mt-4 max-w-2xl text-lg text-muted">
              {course.description}
            </p>
          ) : null}
        </header>

        {/* ----------------------------------------------------- progress panel */}
        {enrollment ? (
          <div className="panel rule-top reveal reveal-2 mt-8 p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow eyebrow-muted">Case progress</p>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="font-display text-4xl font-black text-accent-bright">
                    {pct}%
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {doneCount}/{totalUnits} units
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {firstUnit ? (
                  <Link
                    href={`/courses/${slug}/units/${firstUnit.id}`}
                    className="btn btn-primary"
                  >
                    {pct > 0 ? "Resume" : "Start course"}
                  </Link>
                ) : null}
                {certificate ? (
                  <Link
                    href={`/certificates/${certificate.serial}`}
                    className="btn btn-gold"
                  >
                    🏅 View certificate
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="mt-5">
              <div className="h-[6px] w-full overflow-hidden bg-[rgba(255,255,255,0.06)]">
                <div
                  className="h-full bg-gradient-to-r from-accent to-accent-bright transition-all"
                  style={{
                    width: `${pct}%`,
                    boxShadow: "0 0 12px rgba(0,180,216,0.7)",
                  }}
                />
              </div>
            </div>
          </div>
        ) : course.status === "PUBLISHED" ? (
          <div className="panel rule-top reveal reveal-2 mt-8 p-6">
            <p className="text-muted">This course is open for enrollment.</p>
            <form action={enroll} className="mt-4">
              <input type="hidden" name="slug" value={slug} />
              <button className="btn btn-primary">Enroll</button>
            </form>
          </div>
        ) : (
          <div className="panel rule-top reveal reveal-2 mt-8 p-6">
            <p className="text-muted">Publish this course to allow enrollment.</p>
          </div>
        )}

        {/* -------------------------------------------------------- curriculum */}
        <section className="reveal reveal-3 mt-12">
          <header className="flex items-end justify-between gap-4 border-b border-border pb-3">
            <div>
              <p className="eyebrow eyebrow-gold">01 / Curriculum</p>
              <h2 className="display-lg mt-2">Case file</h2>
            </div>
            <span className="font-mono text-xs text-muted">
              {totalUnits.toString().padStart(2, "0")} units
            </span>
          </header>

          <div className="mt-6 space-y-8">
            {course.sections.length === 0 ? (
              <p className="panel px-6 py-8 text-muted">
                No content yet.
              </p>
            ) : (
              course.sections.map((section, sIdx) => (
                <div key={section.id}>
                  <p className="eyebrow eyebrow-gold">
                    {(sIdx + 1).toString().padStart(2, "0")} / {section.title}
                  </p>
                  <ul className="mt-3 divide-y divide-border overflow-hidden border border-border">
                    {section.units.map((u, uIdx) => {
                      const done = completed.has(u.id);
                      const globalIdx = units.findIndex((x) => x.id === u.id);
                      const row = (
                        <div className="flex items-center gap-4 px-5 py-3.5">
                          <span className="font-mono text-xs text-muted">
                            {(globalIdx + 1).toString().padStart(2, "0")}
                          </span>
                          <span className="text-lg text-accent">
                            {UNIT_ICON[u.type]}
                          </span>
                          <span className="flex-1 text-[15px] text-foreground">
                            {u.title}
                          </span>
                          <span className="tag-chip tag-chip-cyan hidden sm:inline-flex">
                            {UNIT_LABEL[u.type]}
                          </span>
                          {done ? (
                            <span className="text-sm text-success">✓</span>
                          ) : (
                            <span className="text-sm text-muted/40">○</span>
                          )}
                        </div>
                      );
                      return (
                        <li key={u.id} className="bg-surface/50">
                          {enrollment ? (
                            <Link
                              href={`/courses/${slug}/units/${u.id}`}
                              className="block transition hover:bg-surface-2"
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
                      <li className="bg-surface/50 px-5 py-4 text-sm text-muted">
                        No units.
                      </li>
                    ) : null}
                  </ul>
                </div>
              ))
            )}
          </div>
        </section>

        {canForum ? (
          <CourseForum
            courseId={course.id}
            slug={slug}
            questions={questions}
            viewerId={user.id}
            isAdmin={isAdmin}
          />
        ) : null}
      </main>
    </div>
  );
}
