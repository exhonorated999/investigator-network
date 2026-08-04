import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { AUDIENCE_SHORT } from "@/lib/audience";
import type { Audience } from "@/generated/prisma";
import { ConfirmSubmit } from "../confirm-button";
import { adminEnrollUser, adminUnenrollUser } from "../actions";
import { PasswordResetForm } from "./password-reset-form";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await requireAdmin();
  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSuperAdmin: true },
  });
  const actorIsSuper = actor?.isSuperAdmin ?? false;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      enrollments: {
        orderBy: { enrolledAt: "desc" },
        include: {
          course: {
            include: {
              category: true,
              sections: { include: { units: { select: { id: true } } } },
            },
          },
        },
      },
      certificates: { select: { courseId: true } },
    },
  });
  if (!user) notFound();

  // Progress across all enrolled courses in one query.
  const allUnitIds = user.enrollments.flatMap((e) =>
    e.course.sections.flatMap((s) => s.units.map((u) => u.id))
  );
  const completedRows = allUnitIds.length
    ? await prisma.unitProgress.findMany({
        where: { userId: user.id, unitId: { in: allUnitIds }, status: "COMPLETE" },
        select: { unitId: true },
      })
    : [];
  const completedSet = new Set(completedRows.map((c) => c.unitId));
  const certifiedSet = new Set(user.certificates.map((c) => c.courseId));

  const enrolledCourseIds = new Set(user.enrollments.map((e) => e.courseId));

  // Courses this user is NOT yet enrolled in — candidates for manual enrolment.
  const allCourses = await prisma.course.findMany({
    orderBy: [{ status: "asc" }, { title: "asc" }],
    select: { id: true, title: true, isPrivate: true, status: true },
  });
  const enrollableCourses = allCourses.filter((c) => !enrolledCourseIds.has(c.id));

  const canManage =
    !user.isSuperAdmin &&
    user.id !== session.user.id &&
    (user.role !== "ADMIN" || actorIsSuper);

  const rows = user.enrollments.map((e) => {
    const units = e.course.sections.flatMap((s) => s.units);
    const done = units.filter((u) => completedSet.has(u.id)).length;
    const pct = units.length ? Math.round((done / units.length) * 100) : 0;
    return {
      courseId: e.course.id,
      slug: e.course.slug,
      title: e.course.title,
      category: e.course.category?.name ?? null,
      total: units.length,
      done,
      pct,
      enrolledAt: e.enrolledAt,
      certified: certifiedSet.has(e.course.id),
    };
  });

  return (
    <div className="reveal">
      <Link
        href="/admin/users"
        className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted hover:text-accent-bright"
      >
        ← Back to users
      </Link>

      {/* ---------------------------------------------------------- header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow eyebrow-gold">// USER PROFILE</p>
          <h1 className="display-lg mt-2 flex items-center gap-3 text-foreground">
            {user.name}
            {user.role === "ADMIN" && (
              <span
                className={`inline-block border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                  user.isSuperAdmin
                    ? "border-gold/50 text-gold bg-[rgba(244,162,97,0.10)]"
                    : "border-accent-bright/40 text-accent-bright bg-[rgba(0,180,216,0.08)]"
                }`}
              >
                {user.isSuperAdmin ? "Super Admin" : "Admin"}
              </span>
            )}
          </h1>
          <p className="mt-2 font-mono text-[12px] text-muted">{user.email}</p>
        </div>
        <div className="grid gap-1 text-right font-mono text-[12px] text-muted">
          <span>
            <span className="opacity-60">Side: </span>
            {AUDIENCE_SHORT[user.audience as Audience]}
          </span>
          <span>
            <span className="opacity-60">Agency: </span>
            {user.agency || "—"}
          </span>
          <span>
            <span className="opacity-60">Status: </span>
            {user.status}
          </span>
          <span>
            <span className="opacity-60">Registered: </span>
            {user.createdAt.toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------- enrolments */}
      <section className="panel mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Enrolled courses
          </h2>
          <span className="font-mono text-[11px] text-muted">
            {rows.length} {rows.length === 1 ? "course" : "courses"}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Not enrolled in any courses yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left">
                <tr>
                  <th className="eyebrow eyebrow-muted px-3 py-2">Course</th>
                  <th className="eyebrow eyebrow-muted px-3 py-2">Progress</th>
                  <th className="eyebrow eyebrow-muted px-3 py-2">Enrolled</th>
                  <th className="eyebrow eyebrow-muted px-3 py-2 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.courseId} className="border-t border-border">
                    <td className="px-3 py-3">
                      <Link
                        href={`/courses/${r.slug}`}
                        className="text-foreground hover:text-accent-bright"
                      >
                        {r.title}
                      </Link>
                      {r.certified && (
                        <span className="ml-2 inline-block border border-gold/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-gold bg-[rgba(244,162,97,0.10)]">
                          Certified
                        </span>
                      )}
                      {r.category && (
                        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                          {r.category}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-[6px] w-28 overflow-hidden bg-[rgba(255,255,255,0.08)]">
                          <div
                            className={`h-full ${
                              r.pct === 100
                                ? "bg-gold"
                                : "bg-gradient-to-r from-accent to-accent-bright"
                            }`}
                            style={{ width: `${r.pct}%` }}
                          />
                        </div>
                        <span
                          className={`font-mono text-[11px] ${
                            r.pct === 100 ? "text-gold" : "text-accent-bright"
                          }`}
                        >
                          {r.pct}%
                        </span>
                        <span className="font-mono text-[11px] text-muted">
                          ({r.done}/{r.total})
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] text-muted">
                      {r.enrolledAt.toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end">
                        <form action={adminUnenrollUser}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input
                            type="hidden"
                            name="courseId"
                            value={r.courseId}
                          />
                          <ConfirmSubmit
                            label="Unenroll"
                            message={`Unenroll ${user.name} from “${r.title}”? Their progress in this course will be cleared.`}
                            className="btn btn-ghost btn-sm border-danger/40 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)] hover:text-danger"
                          />
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Manual enrol */}
        <form
          action={adminEnrollUser}
          className="mt-5 flex flex-wrap items-end gap-2 border-t border-border pt-5"
        >
          <input type="hidden" name="userId" value={user.id} />
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Enroll in a course</span>
            <select name="courseId" required className="field w-72" defaultValue="">
              <option value="" disabled>
                Select a course…
              </option>
              {enrollableCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                  {c.status !== "PUBLISHED" ? " (draft)" : ""}
                  {c.isPrivate ? " · private" : ""}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary btn-sm">
            Enroll
          </button>
          {enrollableCourses.length === 0 && (
            <span className="font-mono text-[11px] text-muted">
              Enrolled in every course.
            </span>
          )}
        </form>
      </section>

      {/* ------------------------------------------------------ password */}
      <section className="panel mt-6 p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Reset password
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          Set a new temporary password for this user.
        </p>
        <div className="mt-4">
          {canManage ? (
            <PasswordResetForm userId={user.id} />
          ) : (
            <p className="font-mono text-[11px] text-muted">
              {user.isSuperAdmin
                ? "// The super admin's password cannot be reset here."
                : user.id === session.user.id
                ? "// Reset your own password from account settings."
                : "// Only the super admin can reset another admin's password."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
