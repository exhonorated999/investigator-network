"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toggleFavorite } from "@/app/dashboard/actions";

export type Shelf = "assigned" | "available" | "completed";

export interface AlbumCourse {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string | null;
  coverImage: string | null;
  units: number;
  done: number;
  pct: number;
  favorite: boolean;
  shelf: Shelf;
}

const SHELVES: { id: Shelf; label: string }[] = [
  { id: "assigned", label: "Assigned" },
  { id: "available", label: "Available" },
  { id: "completed", label: "Completed" },
];

/** Deterministic hue per course so procedural artwork is stable. */
function hueOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

function Artwork({ course, small }: { course: AlbumCourse; small?: boolean }) {
  const hue = hueOf(course.id || course.slug);
  const initials = course.title
    .split(/\s+/)
    .filter((w) => /[a-z]/i.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  if (course.coverImage) {
    return (
      // Covers are operator-supplied URLs; plain img avoids remote-pattern config.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={course.coverImage}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }

  return (
    <div
      className="absolute inset-0"
      style={{
        background: `
          radial-gradient(circle at 30% 20%, hsla(${hue}, 85%, 60%, 0.55), transparent 60%),
          radial-gradient(circle at 75% 80%, hsla(${(hue + 55) % 360}, 90%, 55%, 0.4), transparent 60%),
          linear-gradient(160deg, #10141c, #070910)
        `,
      }}
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />
      <span
        className={`absolute inset-0 flex items-center justify-center font-display font-black tracking-tight text-white/85 ${
          small
            ? "text-[13px]"
            : "text-[4.5rem] drop-shadow-[0_0_24px_rgba(0,180,216,0.6)]"
        }`}
      >
        {initials || "IN"}
      </span>
    </div>
  );
}

export function CourseAlbum({ courses }: { courses: AlbumCourse[] }) {
  const counts = useMemo(
    () => ({
      assigned: courses.filter((c) => c.shelf === "assigned").length,
      available: courses.filter((c) => c.shelf === "available").length,
      completed: courses.filter((c) => c.shelf === "completed").length,
    }),
    [courses]
  );

  const firstNonEmpty =
    (SHELVES.find((s) => counts[s.id] > 0)?.id as Shelf | undefined) ?? "assigned";

  const [shelf, setShelf] = useState<Shelf>(firstNonEmpty);
  const [index, setIndex] = useState(0);

  const list = useMemo(
    () => courses.filter((c) => c.shelf === shelf),
    [courses, shelf]
  );

  useEffect(() => {
    setIndex(0);
  }, [shelf]);

  const current = list[Math.min(index, Math.max(list.length - 1, 0))];

  const go = (delta: number) => {
    if (list.length === 0) return;
    setIndex((i) => (i + delta + list.length) % list.length);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      }
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  return (
    <section className="panel rule-top flex h-full flex-col p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow eyebrow-gold">01 / The library</p>
          <h2 className="display-sm mt-2 text-[1.15rem]">My training</h2>
        </div>

        <div className="flex flex-wrap gap-1 border border-border p-1">
          {SHELVES.map((s) => {
            const active = s.id === shelf;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setShelf(s.id)}
                className={`px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.16em] transition ${
                  active
                    ? "bg-[rgba(0,180,216,0.16)] text-accent-bright"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {s.label}
                <span className="ml-1.5 font-mono text-[9px] opacity-70">
                  {counts[s.id]}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {!current ? (
        <p className="mt-6 flex-1 text-muted">
          {shelf === "assigned"
            ? "No active enrollments. Switch to Available to open your first case file."
            : shelf === "completed"
              ? "Nothing completed yet — finish a course to see it here."
              : "You are enrolled in everything currently published."}
        </p>
      ) : (
        <div className="mt-6 flex flex-1 flex-col gap-6 sm:flex-row">
          {/* ---------------------------------------------------- album art */}
          <div className="relative shrink-0 sm:w-[236px]">
            <Link
              href={`/courses/${current.slug}`}
              className="bracket group block aspect-square w-full overflow-hidden border border-border-strong"
              style={{ boxShadow: "0 18px 50px -22px rgba(0,180,216,0.7)" }}
            >
              <Artwork course={current} />
              <span className="absolute inset-0 bg-gradient-to-t from-[rgba(7,9,16,0.85)] via-transparent to-transparent" />
              <span className="tag-chip absolute bottom-2 left-2">
                // {current.shelf === "completed" ? "Closed" : "Case file"}
              </span>
              <span
                className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
                style={{
                  background:
                    "linear-gradient(120deg, transparent 40%, rgba(144,224,239,0.22) 50%, transparent 60%)",
                }}
              />
            </Link>

            {list.length > 1 ? (
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous course"
                  className="btn btn-ghost btn-sm px-3"
                >
                  ←
                </button>
                <span className="font-mono text-[11px] text-muted">
                  {String(index + 1).padStart(2, "0")} /{" "}
                  {String(list.length).padStart(2, "0")}
                </span>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next course"
                  className="btn btn-ghost btn-sm px-3"
                >
                  →
                </button>
              </div>
            ) : null}
          </div>

          {/* --------------------------------------------------- album meta */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-3">
              <span className="eyebrow">{current.category ?? "Training"}</span>
              <form action={toggleFavorite}>
                <input type="hidden" name="courseId" value={current.id} />
                <input type="hidden" name="slug" value={current.slug} />
                <button
                  type="submit"
                  title={current.favorite ? "Remove favorite" : "Add favorite"}
                  className={`shrink-0 text-lg leading-none transition hover:scale-110 ${
                    current.favorite ? "text-gold" : "text-muted hover:text-gold"
                  }`}
                >
                  {current.favorite ? "★" : "☆"}
                </button>
              </form>
            </div>

            <h3 className="display-sm mt-2 text-[1.35rem] leading-tight">
              <Link
                href={`/courses/${current.slug}`}
                className="transition hover:text-accent-bright"
              >
                {current.title}
              </Link>
            </h3>

            <p className="mt-3 line-clamp-4 text-[15px] text-muted">
              {current.description || "No description provided."}
            </p>

            <div className="mt-auto pt-5">
              {current.shelf === "available" ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[11px] text-muted">
                    {current.units} units
                  </span>
                  <Link href={`/courses/${current.slug}`} className="btn btn-primary btn-sm">
                    Open file
                  </Link>
                </div>
              ) : (
                <>
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="font-mono text-[11px] text-muted">
                      {current.done}/{current.units} units
                    </span>
                    <span
                      className={`font-display text-xl font-bold ${
                        current.pct === 100 ? "text-gold" : "text-accent-bright"
                      }`}
                    >
                      {current.pct}%
                    </span>
                  </div>
                  <div className="h-[6px] w-full overflow-hidden bg-[rgba(255,255,255,0.06)]">
                    <div
                      className="h-full bg-gradient-to-r from-accent to-accent-bright transition-all"
                      style={{
                        width: `${current.pct}%`,
                        boxShadow: "0 0 12px rgba(0,180,216,0.7)",
                      }}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/courses/${current.slug}`}
                      className={`btn btn-sm ${
                        current.pct === 100 ? "btn-gold" : "btn-primary"
                      }`}
                    >
                      {current.pct === 100
                        ? "Review course"
                        : current.pct === 0
                          ? "Start"
                          : "Resume"}
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------- spine strip */}
      {list.length > 1 ? (
        <div className="mt-5 flex gap-2 overflow-x-auto border-t border-border pt-4">
          {list.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setIndex(i)}
              title={c.title}
              aria-label={c.title}
              className={`relative h-11 w-11 shrink-0 overflow-hidden border transition ${
                i === index
                  ? "border-accent-bright"
                  : "border-border opacity-60 hover:opacity-100"
              }`}
              style={
                i === index
                  ? { boxShadow: "0 0 14px rgba(0,180,216,0.55)" }
                  : undefined
              }
            >
              <Artwork course={c} small />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
