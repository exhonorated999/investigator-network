import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UNIT_TYPES, UNIT_LABEL } from "@/lib/units";
import { CoverUpload } from "@/components/cover-upload";
import {
  updateCourse,
  setCourseStatus,
  deleteCourse,
  addSection,
  renameSection,
  deleteSection,
  addUnit,
  moveUnit,
  moveSection,
  uploadCourseCover,
  clearCourseCover,
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

  // First unit in reading order — the target for "Preview inside". Sections can
  // legitimately be empty, so scan until we find one that has units.
  const firstUnitId =
    course.sections.flatMap((s) => s.units).at(0)?.id ?? null;

  return (
    <div className="reveal max-w-4xl">
      <Link href="/admin/courses" className="eyebrow eyebrow-muted transition hover:text-accent-bright">
        ← All courses
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="display-lg text-foreground">
            {course.title}
          </h1>
          <span
            className={`inline-block shrink-0 border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
              published
                ? "border-success/40 text-success bg-[rgba(74,222,128,0.08)]"
                : "border-gold/40 text-gold bg-[rgba(244,162,97,0.08)]"
            }`}
          >
            {course.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/courses/${course.slug}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-sm"
            title="Open the learner's course overview page in a new tab"
          >
            Preview overview ↗
          </Link>
          {firstUnitId ? (
            <Link
              href={`/courses/${course.slug}/units/${firstUnitId}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-sm"
              title="Open the course player at the first unit, exactly as a learner sees it"
            >
              Preview inside ↗
            </Link>
          ) : (
            <span
              className="btn btn-ghost btn-sm opacity-30"
              title="Add a unit first"
              aria-disabled="true"
            >
              Preview inside ↗
            </span>
          )}
          <form action={setCourseStatus}>
            <input type="hidden" name="id" value={course.id} />
            <input
              type="hidden"
              name="status"
              value={published ? "DRAFT" : "PUBLISHED"}
            />
            <button className="btn btn-ghost btn-sm">
              {published ? "Unpublish" : "Publish"}
            </button>
          </form>
          <form action={deleteCourse}>
            <input type="hidden" name="id" value={course.id} />
            <button className="btn btn-ghost btn-sm border-danger/40 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)] hover:text-danger">
              Delete
            </button>
          </form>
        </div>
      </div>

      {/* Meta */}
      <section className="panel rule-top mt-6 p-5">
        <p className="eyebrow eyebrow-muted">01 / Details</p>
        <form action={updateCourse} className="mt-4 grid gap-4">
          <input type="hidden" name="id" value={course.id} />
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Title</span>
            <input
              name="title"
              defaultValue={course.title}
              className="field"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="eyebrow eyebrow-muted">Category</span>
              <input
                name="category"
                list="cats"
                defaultValue={course.category?.name ?? ""}
                className="field"
              />
              <datalist id="cats">
                {categories.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </label>
            <label className="grid gap-1.5">
              <span className="eyebrow eyebrow-muted">Cover image URL</span>
              <input
                name="coverImage"
                defaultValue={course.coverImage ?? ""}
                placeholder="https://…"
                className="field"
              />
            </label>
          </div>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Description</span>
            <textarea
              name="description"
              defaultValue={course.description}
              rows={3}
              className="field"
            />
          </label>
          <div>
            <button className="btn btn-primary btn-sm">
              Save details
            </button>
          </div>
        </form>

        {/* Cover upload — a sibling form, since forms cannot nest. */}
        <div className="mt-5 border-t border-border pt-5">
          <span className="eyebrow eyebrow-muted">Cover image</span>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <div className="relative h-24 w-40 shrink-0 overflow-hidden border border-border bg-[rgba(10,12,17,0.6)]">
              {course.coverImage ? (
                /* Covers may be operator URLs or /api/files/… — plain img
                   avoids next/image remote-pattern config. */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={course.coverImage}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <span className="absolute inset-0 grid place-items-center font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  No cover
                </span>
              )}
            </div>
            <div className="grid gap-2">
              <CoverUpload courseId={course.id} action={uploadCourseCover} />
              <p className="text-xs text-muted">
                PNG, JPEG, WebP, GIF or AVIF — up to 8 MB. Uploading replaces
                whatever is in the URL field above.
              </p>
              {course.coverImage ? (
                <form action={clearCourseCover}>
                  <input type="hidden" name="id" value={course.id} />
                  <button className="btn btn-ghost btn-sm border-danger/40 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)] hover:text-danger">
                    Remove cover
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Curriculum */}
      <section className="mt-6">
        <p className="eyebrow eyebrow-gold">02 / Curriculum</p>

        <div className="mt-4 grid gap-4">
          {course.sections.map((section, si) => (
            <div
              key={section.id}
              className="panel rule-top p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <form action={renameSection} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="id" value={section.id} />
                  <input type="hidden" name="courseId" value={course.id} />
                  <span className="font-mono text-[11px] text-accent">S{String(si + 1).padStart(2, "0")}</span>
                  <input
                    name="title"
                    defaultValue={section.title}
                    className="flex-1 border border-transparent bg-transparent px-2 py-1 font-display text-[14px] font-semibold uppercase tracking-[0.04em] text-foreground outline-none transition hover:border-border focus:border-accent focus:bg-[rgba(10,12,17,0.85)]"
                  />
                  <button className="btn btn-ghost btn-sm">
                    Rename
                  </button>
                </form>
                <form action={moveSection}>
                  <input type="hidden" name="id" value={section.id} />
                  <input type="hidden" name="courseId" value={course.id} />
                  <input type="hidden" name="dir" value="up" />
                  <button
                    className="btn btn-ghost btn-sm px-2 disabled:opacity-25"
                    disabled={si === 0}
                    title="Move section up"
                    aria-label={`Move section ${section.title} up`}
                  >
                    ↑
                  </button>
                </form>
                <form action={moveSection}>
                  <input type="hidden" name="id" value={section.id} />
                  <input type="hidden" name="courseId" value={course.id} />
                  <input type="hidden" name="dir" value="down" />
                  <button
                    className="btn btn-ghost btn-sm px-2 disabled:opacity-25"
                    disabled={si === course.sections.length - 1}
                    title="Move section down"
                    aria-label={`Move section ${section.title} down`}
                  >
                    ↓
                  </button>
                </form>
                <form action={deleteSection}>
                  <input type="hidden" name="id" value={section.id} />
                  <input type="hidden" name="courseId" value={course.id} />
                  <button className="btn btn-ghost btn-sm border-danger/40 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)] hover:text-danger">
                    Delete section
                  </button>
                </form>
              </div>

              <ul className="mt-3 grid gap-2">
                {section.units.map((unit, unitIndex) => (
                  <li
                    key={unit.id}
                    className="flex items-center gap-2 border border-border bg-[rgba(10,12,17,0.6)] pr-2 transition hover:border-border-strong"
                  >
                    <Link
                      href={`/admin/courses/${course.id}/units/${unit.id}`}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2"
                    >
                      <span className="truncate text-[15px] text-foreground">
                        {unit.title}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                        {UNIT_LABEL[unit.type]}
                      </span>
                    </Link>
                    <div className="flex shrink-0 items-center gap-1">
                      <Link
                        href={`/courses/${course.slug}/units/${unit.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost btn-sm px-2"
                        title={`Preview "${unit.title}" as a learner`}
                        aria-label={`Preview ${unit.title} as a learner`}
                      >
                        ↗
                      </Link>
                      <form action={moveUnit}>
                        <input type="hidden" name="id" value={unit.id} />
                        <input type="hidden" name="courseId" value={course.id} />
                        <input
                          type="hidden"
                          name="sectionId"
                          value={section.id}
                        />
                        <input type="hidden" name="dir" value="up" />
                        <button
                          className="btn btn-ghost btn-sm px-2 disabled:opacity-25"
                          disabled={unitIndex === 0}
                          title="Move unit up"
                          aria-label={`Move ${unit.title} up`}
                        >
                          ↑
                        </button>
                      </form>
                      <form action={moveUnit}>
                        <input type="hidden" name="id" value={unit.id} />
                        <input type="hidden" name="courseId" value={course.id} />
                        <input
                          type="hidden"
                          name="sectionId"
                          value={section.id}
                        />
                        <input type="hidden" name="dir" value="down" />
                        <button
                          className="btn btn-ghost btn-sm px-2 disabled:opacity-25"
                          disabled={unitIndex === section.units.length - 1}
                          title="Move unit down"
                          aria-label={`Move ${unit.title} down`}
                        >
                          ↓
                        </button>
                      </form>
                    </div>
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
                  className="field min-w-40 flex-1"
                />
                <select
                  name="type"
                  className="field w-auto"
                >
                  {UNIT_TYPES.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button className="btn btn-ghost btn-sm">
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
            className="field flex-1"
          />
          <button className="btn btn-primary btn-sm">
            Add section
          </button>
        </form>
      </section>
    </div>
  );
}
