import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UNIT_TYPES, UNIT_LABEL } from "@/lib/units";
import {
  updateCourse,
  setCourseStatus,
  deleteCourse,
  addSection,
  renameSection,
  deleteSection,
  addUnit,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function CourseEditor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [course, categories] = await Promise.all([
    prisma.course.findUnique({
      where: { id },
      include: {
        category: true,
        sections: {
          orderBy: { order: "asc" },
          include: { units: { orderBy: { order: "asc" } } },
        },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!course) notFound();

  const published = course.status === "PUBLISHED";

  return (
    <div className="max-w-4xl">
      <Link href="/admin/courses" className="text-sm text-accent hover:underline">
        ← All courses
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">
            {course.title}
          </h1>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs ${
              published
                ? "border-success/30 bg-success/15 text-success"
                : "border-warning/30 bg-warning/15 text-warning"
            }`}
          >
            {course.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <form action={setCourseStatus}>
            <input type="hidden" name="id" value={course.id} />
            <input
              type="hidden"
              name="status"
              value={published ? "DRAFT" : "PUBLISHED"}
            />
            <button className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:border-accent">
              {published ? "Unpublish" : "Publish"}
            </button>
          </form>
          <form action={deleteCourse}>
            <input type="hidden" name="id" value={course.id} />
            <button className="rounded-lg border border-danger/40 px-3 py-1.5 text-sm text-danger hover:bg-danger/10">
              Delete
            </button>
          </form>
        </div>
      </div>

      {/* Meta */}
      <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-foreground">Details</h2>
        <form action={updateCourse} className="mt-3 grid gap-3">
          <input type="hidden" name="id" value={course.id} />
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Title</span>
            <input
              name="title"
              defaultValue={course.title}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-foreground outline-none focus:border-accent"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Category</span>
              <input
                name="category"
                list="cats"
                defaultValue={course.category?.name ?? ""}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-foreground outline-none focus:border-accent"
              />
              <datalist id="cats">
                {categories.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Cover image URL</span>
              <input
                name="coverImage"
                defaultValue={course.coverImage ?? ""}
                placeholder="https://…"
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-foreground outline-none focus:border-accent"
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Description</span>
            <textarea
              name="description"
              defaultValue={course.description}
              rows={3}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-foreground outline-none focus:border-accent"
            />
          </label>
          <div>
            <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#04212b] hover:bg-accent-strong">
              Save details
            </button>
          </div>
        </form>
      </section>

      {/* Curriculum */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-foreground">Curriculum</h2>

        <div className="mt-3 grid gap-4">
          {course.sections.map((section) => (
            <div
              key={section.id}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <form action={renameSection} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="id" value={section.id} />
                  <input type="hidden" name="courseId" value={course.id} />
                  <input
                    name="title"
                    defaultValue={section.title}
                    className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 font-medium text-foreground hover:border-border focus:border-accent focus:bg-surface-2 outline-none"
                  />
                  <button className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground">
                    Rename
                  </button>
                </form>
                <form action={deleteSection}>
                  <input type="hidden" name="id" value={section.id} />
                  <input type="hidden" name="courseId" value={course.id} />
                  <button className="rounded-md border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/10">
                    Delete section
                  </button>
                </form>
              </div>

              <ul className="mt-3 grid gap-2">
                {section.units.map((unit) => (
                  <li key={unit.id}>
                    <Link
                      href={`/admin/courses/${course.id}/units/${unit.id}`}
                      className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm transition hover:border-accent"
                    >
                      <span className="text-foreground">{unit.title}</span>
                      <span className="text-xs text-muted">
                        {UNIT_LABEL[unit.type]}
                      </span>
                    </Link>
                  </li>
                ))}
                {section.units.length === 0 && (
                  <li className="text-sm text-muted">No units yet.</li>
                )}
              </ul>

              <form
                action={addUnit}
                className="mt-3 flex flex-wrap items-center gap-2"
              >
                <input type="hidden" name="sectionId" value={section.id} />
                <input type="hidden" name="courseId" value={course.id} />
                <input
                  name="title"
                  placeholder="New unit title"
                  className="flex-1 min-w-40 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent"
                />
                <select
                  name="type"
                  className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent"
                >
                  {UNIT_TYPES.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm text-accent hover:bg-accent/10">
                  Add unit
                </button>
              </form>
            </div>
          ))}
        </div>

        <form action={addSection} className="mt-4 flex items-center gap-2">
          <input type="hidden" name="courseId" value={course.id} />
          <input
            name="title"
            placeholder="New section title"
            className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-foreground outline-none focus:border-accent"
          />
          <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#04212b] hover:bg-accent-strong">
            Add section
          </button>
        </form>
      </section>
    </div>
  );
}
