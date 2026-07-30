import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireViewer } from "@/lib/viewer";
import { SiteHeader } from "@/components/site-header";
import { CourseAlbum, type AlbumCourse } from "@/components/course-album";
import { NotificationsCard } from "@/components/widgets/notifications-card";
import { CustomizePanel } from "@/components/widgets/customize-panel";
import {
  CourseRow,
  WidgetCard,
  WidgetEmpty,
  WidgetStub,
} from "@/components/widgets/widget-shell";
import { loadNotifications } from "@/lib/notifications";
import { NewsCard } from "@/components/widgets/news-card";
import { loadNewsFeed, loadNewsTopics, loadTopics } from "@/lib/news";
import { loadEnabledWidgets } from "@/lib/dashboard-prefs";
import {
  SPAN_CLASS,
  widgetMeta,
  type WidgetId,
} from "@/lib/dashboard";

export const dynamic = "force-dynamic";

const RESOURCES: { label: string; note: string; href: string }[] = [
  {
    label: "Report writing templates",
    note: "Case narrative + supplemental formats",
    href: "/dashboard",
  },
  {
    label: "Interview & interrogation aids",
    note: "Question frameworks, Miranda checklist",
    href: "/dashboard",
  },
  {
    label: "Evidence handling checklist",
    note: "Chain of custody quick reference",
    href: "/dashboard",
  },
  {
    label: "Financial records subpoena guide",
    note: "Bank, crypto and money-service requests",
    href: "/dashboard",
  },
];

export default async function DashboardPage() {
  const viewer = await requireViewer();
  const user = viewer;
  const isAdmin = viewer.role === "ADMIN";

  const [enrollments, favorites, certificates, enabled, notifications, news, topics, newsTopics] =
    await Promise.all([
      prisma.enrollment.findMany({
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
      }),
      prisma.courseFavorite.findMany({
        where: { userId: user.id },
        select: { courseId: true },
      }),
      prisma.certificate.findMany({
        where: { userId: user.id },
        orderBy: { issuedAt: "desc" },
        include: { course: { select: { title: true, slug: true } } },
      }),
      loadEnabledWidgets(user.id),
      loadNotifications(user.id),
      loadNewsFeed(user.id, 5),
      loadTopics(),
      loadNewsTopics(user.id),
    ]);

  const favoriteIds = new Set(favorites.map((f) => f.courseId));
  const enrolledCourseIds = enrollments.map((e) => e.courseId);

  const allUnitIds = enrollments.flatMap((e) =>
    e.course.sections.flatMap((s) => s.units.map((u) => u.id))
  );
  const completedRows = allUnitIds.length
    ? await prisma.unitProgress.findMany({
        where: { userId: user.id, unitId: { in: allUnitIds }, status: "COMPLETE" },
        select: { unitId: true },
      })
    : [];
  const completedSet = new Set(completedRows.map((c) => c.unitId));

  const available = await prisma.course.findMany({
    where: { status: "PUBLISHED", id: { notIn: enrolledCourseIds } },
    orderBy: { updatedAt: "desc" },
    include: {
      category: true,
      sections: { include: { units: { select: { id: true } } } },
    },
  });

  const [gradedAttempts, passedAttempts] = await Promise.all([
    prisma.attempt.count({ where: { userId: user.id, status: "GRADED" } }),
    prisma.attempt.count({ where: { userId: user.id, status: "GRADED", passed: true } }),
  ]);

  // ------------------------------------------------------------- album data
  const enrolledAlbums: AlbumCourse[] = enrollments.map((e) => {
    const units = e.course.sections.flatMap((s) => s.units);
    const done = units.filter((u) => completedSet.has(u.id)).length;
    const pct = units.length ? Math.round((done / units.length) * 100) : 0;
    return {
      id: e.course.id,
      slug: e.course.slug,
      title: e.course.title,
      description: e.course.description,
      category: e.course.category?.name ?? null,
      coverImage: e.course.coverImage,
      units: units.length,
      done,
      pct,
      favorite: favoriteIds.has(e.course.id),
      shelf: pct === 100 ? "completed" : "assigned",
    };
  });

  const availableAlbums: AlbumCourse[] = available.map((c) => {
    const units = c.sections.flatMap((s) => s.units);
    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description,
      category: c.category?.name ?? null,
      coverImage: c.coverImage,
      units: units.length,
      done: 0,
      pct: 0,
      favorite: favoriteIds.has(c.id),
      shelf: "available",
    };
  });

  const albums = [...enrolledAlbums, ...availableAlbums];
  const inProgress = enrolledAlbums.filter((c) => c.shelf === "assigned");
  const finished = enrolledAlbums.filter((c) => c.shelf === "completed");
  const favoriteCourses = albums.filter((c) => c.favorite);
  const certBySlug = new Map(certificates.map((c) => [c.course.slug, c.serial]));

  const totalUnitsDone = completedSet.size;
  const passRate =
    gradedAttempts > 0 ? Math.round((passedAttempts / gradedAttempts) * 100) : null;
  const firstName = user.name?.trim().split(" ")[0] ?? "Investigator";
  const nextUp = inProgress[0] ?? null;

  // ------------------------------------------------------------ widget map
  function renderWidget(id: WidgetId) {
    switch (id) {
      case "stats":
        return (
          <WidgetCard number="03" eyebrow="Snapshot" title="Progress">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { v: inProgress.length, l: "Active courses", c: "text-accent-bright" },
                { v: totalUnitsDone, l: "Units completed", c: "text-foreground" },
                { v: certificates.length, l: "Certificates", c: "text-gold" },
                {
                  v: passRate == null ? "—" : `${passRate}%`,
                  l: "Test pass rate",
                  c: "text-accent-bright",
                },
              ].map((s) => (
                <div key={s.l}>
                  <p
                    className={`font-display text-3xl font-black leading-none ${s.c}`}
                  >
                    {s.v}
                  </p>
                  <p className="eyebrow eyebrow-muted mt-2">{s.l}</p>
                </div>
              ))}
            </div>
          </WidgetCard>
        );

      case "favorites":
        return (
          <WidgetCard
            number="04"
            eyebrow="Starred"
            title="Favorites"
            count={favoriteCourses.length}
            tone="gold"
          >
            {favoriteCourses.length === 0 ? (
              <WidgetEmpty>
                Star a course from the library card to pin it here.
              </WidgetEmpty>
            ) : (
              <div>
                {favoriteCourses.slice(0, 6).map((c) => (
                  <CourseRow
                    key={c.id}
                    href={`/courses/${c.slug}`}
                    title={c.title}
                    meta={c.category ?? "Training"}
                    right={
                      <span
                        className={`shrink-0 font-display text-sm font-bold ${
                          c.pct === 100 ? "text-gold" : "text-accent-bright"
                        }`}
                      >
                        {c.shelf === "available" ? "—" : `${c.pct}%`}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </WidgetCard>
        );

      case "completed":
        return (
          <WidgetCard
            number="05"
            eyebrow="On the record"
            title="Completed"
            count={finished.length}
            tone="gold"
          >
            {finished.length === 0 ? (
              <WidgetEmpty>
                Finish every unit in a course to close the file and earn a
                certificate.
              </WidgetEmpty>
            ) : (
              <div>
                {finished.slice(0, 6).map((c) => {
                  const serial = certBySlug.get(c.slug);
                  return (
                    <CourseRow
                      key={c.id}
                      href={serial ? `/certificates/${serial}` : `/courses/${c.slug}`}
                      title={c.title}
                      meta={serial ?? "Certificate pending"}
                      right={
                        <span className="shrink-0 text-gold">
                          {serial ? "🏅" : "✓"}
                        </span>
                      }
                    />
                  );
                })}
              </div>
            )}
          </WidgetCard>
        );

      case "resources":
        return (
          <WidgetCard
            number="06"
            eyebrow="Field kit"
            title="Tools & resources"
            count={RESOURCES.length}
          >
            <div>
              {RESOURCES.map((r) => (
                <CourseRow
                  key={r.label}
                  href={r.href}
                  title={r.label}
                  meta={r.note}
                  right={<span className="shrink-0 text-muted">→</span>}
                />
              ))}
            </div>
          </WidgetCard>
        );

      case "news":
        return (
          <NewsCard
            number="07"
            articles={news}
            topics={topics}
            selected={newsTopics}
          />
        );

      case "messages":
        return (
          <WidgetStub
            number="08"
            eyebrow="Comms"
            title="Messages"
            blurb="Direct messages from instructors and administrators. Waiting on your call: broadcast-only, or two-way threads."
          />
        );

      case "network":
        return (
          <WidgetStub
            number="09"
            eyebrow="The network"
            title="Network activity"
            blurb="Aggregate activity across agencies — who is completing what, without exposing individual case work."
          />
        );

      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader name={user.name} isAdmin={isAdmin} />

      <main className="mx-auto max-w-7xl px-5 pb-20 pt-8">
        {/* ------------------------------------------------------------ hero */}
        <section className="reveal reveal-1 flex flex-wrap items-end justify-between gap-5">
          <div>
            <span className="pill">Case file active</span>
            <h1 className="display-lg mt-4">
              Welcome back, <span className="glow-text">{firstName}</span>
            </h1>
            <p className="mt-3 max-w-2xl text-[17px] text-muted">
              {user.agency ? (
                <>
                  <strong className="font-semibold text-foreground">
                    {user.agency}
                  </strong>{" "}
                  ·{" "}
                </>
              ) : null}
              {nextUp
                ? `${inProgress.length} course${inProgress.length === 1 ? "" : "s"} in progress · ${notifications.length} notification${notifications.length === 1 ? "" : "s"}`
                : "No active training. Open the library to enroll."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {nextUp ? (
              <Link
                href={`/courses/${nextUp.slug}`}
                className="btn btn-primary btn-sm"
              >
                Resume training
              </Link>
            ) : null}
            <CustomizePanel enabled={enabled} />
          </div>
        </section>

        {/* ---------------------------------------- pinned snapshot (top) */}
        {enabled.includes("stats") ? (
          <div className="reveal reveal-2 mt-9">{renderWidget("stats")}</div>
        ) : null}

        {/* --------------------------------------------------- widget canvas */}
        <div
          className={`reveal reveal-2 grid gap-5 lg:grid-cols-6 ${
            enabled.includes("stats") ? "mt-5" : "mt-9"
          }`}
        >
          <div className={SPAN_CLASS[widgetMeta("courses").span]}>
            <CourseAlbum courses={albums} />
          </div>
          <div className={SPAN_CLASS[widgetMeta("notifications").span]}>
            <NotificationsCard items={notifications} />
          </div>

          {enabled
            .filter((id) => id !== "stats")
            .map((id) => (
              <div key={id} className={SPAN_CLASS[widgetMeta(id).span]}>
                {renderWidget(id)}
              </div>
            ))}
        </div>

        {enabled.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted">
            Want more on this page? Use{" "}
            <span className="text-accent-bright">Customize</span> to add cards.
          </p>
        ) : null}
      </main>
    </div>
  );
}
