import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireViewer } from "@/lib/viewer";
import { SignOutButton } from "@/components/sign-out";
import { ThemeToggle } from "@/components/theme-toggle";
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
  const user = await requireViewer();
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
  const doneCount = completed.size;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[320px_1fr]">
      {/* ----------------------------------------------------------- outline */}
      <aside className="border-b border-border bg-surface md:sticky md:top-0 md:min-h-screen md:border-b-0 md:border-r">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Image src="/brand/logo.png" alt="" width={28} height={28} />
          <Link
            href={`/courses/${slug}`}
            className="display-sm text-[13px] text-foreground transition hover:text-accent-bright"
          >
            {course.title}
          </Link>
        </div>

        {/* progress */}
        <div className="border-b border-border px-4 py-3">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-mono text-[11px] text-muted">
              {doneCount}/{total} units
            </span>
            <span className="font-display text-lg font-bold text-accent-bright">
              {pct}%
            </span>
          </div>
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

        <nav className="pb-6">
          {course.sections.map((section) => (
            <div key={section.id} className="mt-3">
              <p className="eyebrow eyebrow-muted px-4 py-1.5 text-[10px]">
                {section.title}
              </p>
              <ul>
                {section.units.map((u) => {
                  const active = u.id === unitId;
                  const done = completed.has(u.id);
                  const uIdx = units.findIndex((x) => x.id === u.id);
                  return (
                    <li key={u.id}>
                      <Link
                        href={`/courses/${slug}/units/${u.id}`}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition ${
                          active
                            ? "border-l-2 border-accent bg-surface-2 text-foreground"
                            : "border-l-2 border-transparent text-muted hover:bg-surface-2 hover:text-foreground"
                        }`}
                        style={
                          active
                            ? { boxShadow: "inset 2px 0 12px rgba(0,180,216,0.25)" }
                            : undefined
                        }
                      >
                        <span className="font-mono text-[11px] text-muted">
                          {(uIdx + 1).toString().padStart(2, "0")}
                        </span>
                        <span className="flex-1 truncate">{u.title}</span>
                        {done ? (
                          <span className="text-xs text-success">✓</span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* ----------------------------------------------------------- content */}
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-border px-6 py-3">
          <Link
            href="/dashboard"
            className="eyebrow eyebrow-muted transition hover:text-accent-bright"
          >
            ← My training
          </Link>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-muted">
              UNIT {String(index + 1).padStart(2, "0")} OF {String(total).padStart(2, "0")}
            </span>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
          <span className="tag-chip tag-chip-cyan">
            {UNIT_ICON[current.type]} {current.type.replace("_", " ")}
          </span>
          <h1 className="display-lg mt-4">{current.title}</h1>

          <div className="mt-8">
            {current.type === "QUIZ" ? (
              <QuizTaker unitId={current.id} slug={slug} userId={user.id} />
            ) : (
              <UnitView unit={current} slug={slug} />
            )}
          </div>

          {/* Completion */}
          {current.type !== "FILE_ASSIGNMENT" && current.type !== "QUIZ" ? (
            <form action={setUnitComplete} className="mt-8">
              <input type="hidden" name="unitId" value={current.id} />
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="complete" value={isDone ? "false" : "true"} />
              <button
                className={isDone ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"}
                style={
                  isDone
                    ? { color: "var(--success)", borderColor: "rgba(74,222,128,0.4)" }
                    : undefined
                }
              >
                {isDone ? "✓ Completed — mark incomplete" : "Mark as complete"}
              </button>
            </form>
          ) : current.type === "FILE_ASSIGNMENT" && isDone ? (
            <p className="mt-8 text-sm text-success">✓ Assignment submitted.</p>
          ) : null}

          {/* Prev / next */}
          <div className="mt-12 flex items-center justify-between border-t border-border pt-6">
            {prevId ? (
              <Link
                href={`/courses/${slug}/units/${prevId}`}
                className="btn btn-ghost btn-sm"
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            {nextId ? (
              <Link
                href={`/courses/${slug}/units/${nextId}`}
                className="btn btn-ghost btn-sm"
              >
                Next →
              </Link>
            ) : (
              <Link href={`/courses/${slug}`} className="btn btn-gold">
                Finish
              </Link>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
