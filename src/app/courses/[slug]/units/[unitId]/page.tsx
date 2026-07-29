import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/sign-out";
import { UnitView } from "@/components/unit-view";
import { QuizTaker } from "@/components/quiz-taker";
import {
  loadCourseBySlug,
  flattenUnits,
  progressMap,
  percentComplete,
  neighbors,
  UNIT_ICON,
} from "@/lib/course";
import { setUnitComplete } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function CoursePlayer({
  params,
}: {
  params: Promise<{ slug: string; unitId: string }>;
}) {
  const { slug, unitId } = await params;
  const session = await auth();
  const user = session!.user;
  const isAdmin = user.role === "ADMIN";

  const course = await loadCourseBySlug(slug);
  if (!course) notFound();
  if (course.status !== "PUBLISHED" && !isAdmin) redirect("/dashboard");

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
  });
  // Admins can preview without enrolling; learners must enroll first.
  if (!enrollment && !isAdmin) redirect(`/courses/${slug}`);

  const units = flattenUnits(course);
  const current = units.find((u) => u.id === unitId);
  if (!current) notFound();

  const completed = await progressMap(user.id, course);
  const pct = percentComplete(course, completed);
  const { prevId, nextId, index, total } = neighbors(course, unitId);
  const isDone = completed.has(unitId);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[320px_1fr]">
      {/* Outline */}
      <aside className="border-b border-border bg-surface md:min-h-screen md:border-b-0 md:border-r">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Image src="/brand/logo.png" alt="" width={28} height={28} />
          <Link href={`/courses/${slug}`} className="text-sm font-semibold text-foreground hover:text-accent">
            {course.title}
          </Link>
        </div>
        <div className="px-4 py-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">{pct}% complete</p>
        </div>
        <nav className="pb-6">
          {course.sections.map((section) => (
            <div key={section.id} className="mt-2">
              <p className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                {section.title}
              </p>
              <ul>
                {section.units.map((u) => {
                  const active = u.id === unitId;
                  const done = completed.has(u.id);
                  return (
                    <li key={u.id}>
                      <Link
                        href={`/courses/${slug}/units/${u.id}`}
                        className={`flex items-center gap-2.5 px-4 py-2 text-sm ${
                          active
                            ? "border-l-2 border-accent bg-surface-2 text-foreground"
                            : "border-l-2 border-transparent text-muted hover:bg-surface-2 hover:text-foreground"
                        }`}
                      >
                        <span className="w-4 text-center text-xs">
                          {done ? "✓" : UNIT_ICON[u.type]}
                        </span>
                        <span className="flex-1">{u.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-border px-6 py-3">
          <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
            ← My training
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted">
              Unit {index + 1} of {total}
            </span>
            <SignOutButton />
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
          <span className="text-xs font-medium uppercase tracking-wide text-accent">
            {UNIT_ICON[current.type]} {current.type.replace("_", " ")}
          </span>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{current.title}</h1>

          <div className="mt-6">
            {current.type === "QUIZ" ? (
              <QuizTaker unitId={current.id} slug={slug} userId={user.id} />
            ) : (
              <UnitView unit={current} slug={slug} />
            )}
          </div>

          {/* Completion */}
          {current.type !== "FILE_ASSIGNMENT" && current.type !== "QUIZ" ? (
            <form action={setUnitComplete} className="mt-6">
              <input type="hidden" name="unitId" value={current.id} />
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="complete" value={isDone ? "false" : "true"} />
              <button
                className={`rounded-lg px-5 py-2.5 text-sm font-semibold ${
                  isDone
                    ? "border border-border text-muted hover:border-accent/60"
                    : "bg-success text-[#04212b] hover:opacity-90"
                }`}
              >
                {isDone ? "✓ Completed — mark incomplete" : "Mark as complete"}
              </button>
            </form>
          ) : current.type === "FILE_ASSIGNMENT" && isDone ? (
            <p className="mt-6 text-sm text-success">✓ Assignment submitted.</p>
          ) : null}

          {/* Prev / next */}
          <div className="mt-10 flex items-center justify-between border-t border-border pt-5">
            {prevId ? (
              <Link
                href={`/courses/${slug}/units/${prevId}`}
                className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:border-accent/60"
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            {nextId ? (
              <Link
                href={`/courses/${slug}/units/${nextId}`}
                className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:border-accent/60"
              >
                Next →
              </Link>
            ) : (
              <Link
                href={`/courses/${slug}`}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#04212b] hover:bg-accent-strong"
              >
                Finish
              </Link>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
