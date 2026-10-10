import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireViewer } from "@/lib/viewer";
import { SiteHeader } from "@/components/site-header";
import { isCourseComplete } from "@/lib/certificate";
import { evaluationFor } from "@/lib/evaluation-config";
import { EvaluationForm } from "./evaluation-form";

export const dynamic = "force-dynamic";

export default async function CourseEvaluationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireViewer();
  const config = evaluationFor(slug);
  if (!config) notFound();

  const course = await prisma.course.findUnique({
    where: { slug },
    select: { id: true, title: true },
  });
  if (!course) notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    select: { id: true },
  });
  if (!enrollment) redirect(`/courses/${slug}`);

  const existing = await prisma.courseEvaluation.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    select: { id: true },
  });
  const complete = await isCourseComplete(user.id, course.id);

  return (
    <div className="min-h-screen">
      <SiteHeader name={user.name} isAdmin={user.role === "ADMIN"} />
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-8">
        <Link
          href={`/courses/${slug}`}
          className="eyebrow eyebrow-muted transition hover:text-accent-bright"
        >
          ← Back to course
        </Link>
        <header className="mt-5">
          <p className="eyebrow eyebrow-gold">Course evaluation</p>
          <h1 className="display-lg mt-3">{course.title}</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Your feedback helps us improve this training. The evaluation is
            required before your certificate is issued.
          </p>
        </header>

        <div className="mt-8">
          {existing ? (
            <div className="panel rule-top p-6">
              <p className="text-success">✓ Thank you — your evaluation has been received.</p>
              <Link href={`/courses/${slug}`} className="btn btn-primary mt-4">
                Back to course
              </Link>
            </div>
          ) : !complete ? (
            <div className="panel rule-top p-6">
              <p className="text-muted">
                The evaluation unlocks once you&apos;ve completed all required
                units of the course.
              </p>
              <Link href={`/courses/${slug}`} className="btn btn-primary mt-4">
                Back to course
              </Link>
            </div>
          ) : (
            <EvaluationForm slug={slug} config={config} />
          )}
        </div>
      </main>
    </div>
  );
}
