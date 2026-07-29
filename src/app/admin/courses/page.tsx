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
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Courses</h1>
          <p className="mt-1 text-muted">
            Create and manage training courses.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-foreground">New course</h2>
        <form
          action={createCourse}
          className="mt-3 grid gap-3 sm:grid-cols-[1fr_200px_auto]"
        >
          <input
            name="title"
            required
            placeholder="Course title"
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-foreground outline-none focus:border-accent"
          />
          <input
            name="category"
            list="cats"
            placeholder="Category (optional)"
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-foreground outline-none focus:border-accent"
          />
          <datalist id="cats">
            {categories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 font-semibold text-[#04212b] transition hover:bg-accent-strong"
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
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 transition hover:border-accent"
            >
              <div>
                <div className="font-medium text-foreground">{c.title}</div>
                <div className="mt-0.5 text-sm text-muted">
                  {c.category?.name ?? "Uncategorized"} · {c._count.sections}{" "}
                  sections · {c._count.enrollments} enrolled
                </div>
              </div>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs ${
                  c.status === "PUBLISHED"
                    ? "border-success/30 bg-success/15 text-success"
                    : "border-warning/30 bg-warning/15 text-warning"
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
