import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createCourse } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const [courses, categories] = await Promise.all([
    prisma.course.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        category: true,
        _count: { select: { sections: true, enrollments: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="reveal">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow eyebrow-gold">// COURSE MANAGEMENT</p>
          <h1 className="display-lg mt-2 text-foreground">Courses</h1>
          <p className="mt-2 text-[15px] text-muted">
            Create and manage training courses.
          </p>
        </div>
      </div>

      <div className="panel rule-top mt-6 p-5">
        <p className="eyebrow eyebrow-muted">New course</p>
        <form
          action={createCourse}
          className="mt-3 grid gap-3 sm:grid-cols-[1fr_200px_auto]"
        >
          <input
            name="title"
            required
            placeholder="Course title"
            className="field"
          />
          <input
            name="category"
            list="cats"
            placeholder="Category (optional)"
            className="field"
          />
          <datalist id="cats">
            {categories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          <div className="flex flex-wrap items-center gap-4 sm:col-span-3">
            <span className="eyebrow eyebrow-muted">Audience:</span>
            <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted">
              <input
                type="checkbox"
                name="aud_le"
                defaultChecked
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Law Enforcement
            </label>
            <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted">
              <input
                type="checkbox"
                name="aud_civ"
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Civilian
            </label>
            <label className="ml-auto flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted">
              <input
                type="checkbox"
                name="isPrivate"
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Private (enrol manually)
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:col-span-3">
            <span className="eyebrow eyebrow-muted">Pricing:</span>
            <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted">
              <input
                type="radio"
                name="pricing"
                value="FREE"
                defaultChecked
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Free
            </label>
            <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted">
              <input
                type="radio"
                name="pricing"
                value="PAID"
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Paid
            </label>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
          >
            Create
          </button>
        </form>
      </div>

      <div className="mt-6 grid gap-3">
        {courses.length === 0 ? (
          <p className="text-muted">No courses yet. Create your first above.</p>
        ) : (
          courses.map((c) => (
            <Link
              key={c.id}
              href={`/admin/courses/${c.id}`}
              className="panel panel-hover rule-top flex items-center justify-between p-4"
            >
              <div>
                <div className="display-sm text-foreground">{c.title}</div>
                <div className="mt-1 font-mono text-[11px] text-muted">
                  {c.category?.name ?? "Uncategorized"} · {c._count.sections}{" "}
                  sections · {c._count.enrollments} enrolled
                </div>
              </div>
              <span
                className={`inline-block shrink-0 border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                  c.status === "PUBLISHED"
                    ? "border-success/40 text-success bg-[rgba(74,222,128,0.08)]"
                    : "border-gold/40 text-gold bg-[rgba(244,162,97,0.08)]"
                }`}
              >
                {c.status}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
