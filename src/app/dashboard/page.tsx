import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getViewerUser } from "@/lib/viewer";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-[6px] w-full overflow-hidden bg-[rgba(255,255,255,0.06)]">
      <div
        className="h-full bg-gradient-to-r from-accent to-accent-bright transition-all"
        style={{
          width: `${pct}%`,
          boxShadow: "0 0 12px rgba(0,180,216,0.7)",
        }}
      />
    </div>
  );
}

function Stat({
  value,
  label,
  tone = "cyan",
}: {
  value: string | number;
  label: string;
  tone?: "cyan" | "gold" | "muted";
}) {
  const color =
    tone === "gold"
      ? "text-gold"
      : tone === "muted"
        ? "text-foreground"
        : "text-accent-bright";
  return (
    <div className="panel rule-top px-5 py-4">
      <p className={`font-display text-3xl font-black leading-none ${color}`}>
        {value}
      </p>
      <p className="eyebrow eyebrow-muted mt-2">{label}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const viewer = (await getViewerUser())!;
  const user = viewer;
  const isAdmin = viewer.role === "ADMIN";

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    orderBy: { enrolledAt: "desc" },
    include: {
      course: {
        include: {
          category: true,
          sections: { include: { units: { select: { id: true } } } },
        },
      },
    },
  });

  const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));

  const allUnitIds = enrollments.flatMap((e) =>
    e.course.sections.flatMap((s) => s.units.map((u) => u.id))
  );
  const completed = allUnitIds.length
    ? await prisma.unitProgress.findMany({
        where: { userId: user.id, unitId: { in: allUnitIds }, status: "COMPLETE" },
        select: { unitId: true },
      })
    : [];
  const completedSet = new Set(completed.map((c) => c.unitId));

  const available = await prisma.course.findMany({
    where: { status: "PUBLISHED", id: { notIn: [...enrolledCourseIds] } },
    orderBy: { updatedAt: "desc" },
    include: { category: true, sections: { include: { units: { select: { id: true } } } } },
  });

  const certificates = await prisma.certificate.findMany({
    where: { userId: user.id },
    orderBy: { issuedAt: "desc" },
    include: { course: { select: { title: true } } },
    take: 4,
  });

  // Aggregate progress across everything enrolled.
  const withProgress = enrollments.map((e) => {
    const units = e.course.sections.flatMap((s) => s.units);
    const done = units.filter((u) => completedSet.has(u.id)).length;
    const pct = units.length ? Math.round((done / units.length) * 100) : 0;
    return { e, units: units.length, done, pct };
  });

  const inProgress = withProgress.filter((x) => x.pct < 100);
  const nextUp = inProgress[0] ?? withProgress[0] ?? null;
  const totalDone = withProgress.reduce((n, x) => n + x.done, 0);
  const firstName = user.name?.trim().split(" ")[0] ?? "Investigator";

  return (
    <div className="min-h-screen">
      <SiteHeader name={user.name} isAdmin={isAdmin} />

      <main className="mx-auto max-w-7xl px-5 pb-20 pt-8">
        {/* ------------------------------------------------------------ hero */}
        <section className="reveal reveal-1 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
          <div>
            <span className="pill">Case file active</span>
            <h1 className="display-xl mt-5">
              Welcome back,
              <br />
              <span className="glow-text">{firstName}</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted">
              {user.agency ? (
                <>
                  Credentialed through{" "}
                  <strong className="font-semibold text-foreground">
                    {user.agency}
                  </strong>
                  .{" "}
                </>
              ) : null}
              {nextUp && nextUp.pct < 100
                ? "Your training is in progress — pick up where you left off."
                : "Every case starts with preparation. Browse the training library below."}
            </p>

            {nextUp ? (
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href={`/courses/${nextUp.e.course.slug}`}
                  className="btn btn-primary"
                >
                  {nextUp.pct === 0 ? "Begin training" : "Resume training"}
                </Link>
                <span className="tag-chip">
                  // {nextUp.e.course.title.slice(0, 34)}
                  {nextUp.e.course.title.length > 34 ? "…" : ""}
                </span>
              </div>
            ) : (
              <div className="mt-7">
                <a href="#available" className="btn btn-primary">
                  Browse the catalog
                </a>
              </div>
            )}
          </div>

          <div className="bracket scanlines relative hidden overflow-hidden border border-border lg:block">
            <Image
              src="/brand/banner.png"
              alt=""
              width={720}
              height={480}
              className="h-full w-full object-cover opacity-90"
            />
            <span className="tag-chip absolute bottom-3 left-3">
              // Case file: open
            </span>
          </div>
        </section>

        {/* ----------------------------------------------------------- stats */}
        <section className="reveal reveal-2 mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat value={enrollments.length} label="Active courses" />
          <Stat value={totalDone} label="Units completed" />
          <Stat
            value={certificates.length}
            label="Certificates"
            tone="gold"
          />
          <Stat value={available.length} label="Available now" tone="muted" />
        </section>

        {/* -------------------------------------------------------- my courses */}
        <section className="reveal reveal-3 mt-16">
          <header className="flex items-end justify-between gap-4 border-b border-border pb-3">
            <div>
              <p className="eyebrow eyebrow-gold">01 / In progress</p>
              <h2 className="display-lg mt-2">My training</h2>
            </div>
            <span className="font-mono text-xs text-muted">
              {enrollments.length.toString().padStart(2, "0")} enrolled
            </span>
          </header>

          {withProgress.length === 0 ? (
            <p className="panel mt-5 px-6 py-8 text-muted">
              No active enrollments. Choose a course from the catalog below to open
              your first case file.
            </p>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {withProgress.map(({ e, units, done, pct }) => (
                <Link
                  key={e.id}
                  href={`/courses/${e.course.slug}`}
                  className="panel panel-hover rule-top group flex flex-col p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="eyebrow">
                      {e.course.category?.name ?? "Training"}
                    </span>
                    {pct === 100 ? (
                      <span className="tag-chip">// Complete</span>
                    ) : null}
                  </div>

                  <h3 className="display-sm mt-3 text-foreground transition group-hover:text-accent-bright">
                    {e.course.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 flex-1 text-[15px] text-muted">
                    {e.course.description || "—"}
                  </p>

                  <div className="mt-5">
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="font-mono text-[11px] text-muted">
                        {done}/{units} units
                      </span>
                      <span
                        className={`font-display text-lg font-bold ${
                          pct === 100 ? "text-gold" : "text-accent-bright"
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                    <ProgressBar pct={pct} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------- catalog */}
        <section id="available" className="reveal reveal-4 mt-16 scroll-mt-24">
          <header className="flex items-end justify-between gap-4 border-b border-border pb-3">
            <div>
              <p className="eyebrow eyebrow-gold">02 / The catalog</p>
              <h2 className="display-lg mt-2">Available training</h2>
            </div>
            <span className="font-mono text-xs text-muted">
              {available.length.toString().padStart(2, "0")} open
            </span>
          </header>

          {available.length === 0 ? (
            <p className="panel mt-5 px-6 py-8 text-muted">
              You are enrolled in everything currently published. New courses appear
              here as they are released.
            </p>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {available.map((c) => {
                const unitCount = c.sections.reduce(
                  (n, s) => n + s.units.length,
                  0
                );
                return (
                  <Link
                    key={c.id}
                    href={`/courses/${c.slug}`}
                    className="panel panel-hover group flex flex-col p-5"
                  >
                    <span className="eyebrow">
                      {c.category?.name ?? "Training"}
                    </span>
                    <h3 className="display-sm mt-3 text-foreground transition group-hover:text-accent-bright">
                      {c.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 flex-1 text-[15px] text-muted">
                      {c.description || "—"}
                    </p>
                    <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                      <span className="font-mono text-[11px] text-muted">
                        {unitCount} units
                      </span>
                      <span className="eyebrow transition group-hover:text-accent-bright">
                        Open file →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ----------------------------------------------------- credentials */}
        {certificates.length > 0 ? (
          <section className="reveal reveal-5 mt-16">
            <header className="border-b border-border pb-3">
              <p className="eyebrow eyebrow-gold">03 / On the record</p>
              <h2 className="display-lg mt-2">Your credentials</h2>
            </header>
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {certificates.map((cert) => (
                <Link
                  key={cert.id}
                  href={`/certificates/${cert.serial}`}
                  className="panel panel-hover rule-top-gold rule-top group p-5"
                >
                  <p className="eyebrow eyebrow-gold">Certified</p>
                  <h3 className="display-sm mt-3 text-foreground transition group-hover:text-gold">
                    {cert.course.title}
                  </h3>
                  <p className="mt-3 font-mono text-[11px] text-muted">
                    {cert.serial}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {new Date(cert.issuedAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
