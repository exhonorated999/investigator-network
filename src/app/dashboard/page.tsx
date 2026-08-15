import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireViewer } from "@/lib/viewer";
import { SiteHeader } from "@/components/site-header";
import { CourseAlbum, type AlbumCourse } from "@/components/course-album";
import { NotificationsCard } from "@/components/widgets/notifications-card";
import { SlotCard } from "@/components/widgets/slot-card";
import {
  WidgetCard,
  WidgetStub,
} from "@/components/widgets/widget-shell";
import { loadNotifications } from "@/lib/notifications";
import { courseAudienceWhere } from "@/lib/audience";
import { NewsCard } from "@/components/widgets/news-card";
import { loadNewsFeed, loadNewsTopics, loadTopics } from "@/lib/news";
import { CommunityCard } from "@/components/widgets/community-card";
import { MessagesCard } from "@/components/widgets/messages-card";
import {
  topicsForAudience,
  loadFeed,
  loadTopicCounts,
  type FeedPost,
} from "@/lib/community";
import { loadInbox, loadUnreadCount } from "@/lib/messages";
import { loadUpcomingConferences } from "@/lib/conferences";
import { ConferencesCard } from "@/components/widgets/conferences-card";
import { loadResourcesForViewer } from "@/lib/resources";
import { ResourcesCard } from "@/components/widgets/resources-card";
import { loadSpotlightPartners } from "@/lib/partners";
import { PartnersCard } from "@/components/widgets/partners-card";
import { loadRecentPodcasts } from "@/lib/podcasts";
import { PodcastsCard } from "@/components/widgets/podcasts-card";
import { loadLayout } from "@/lib/dashboard-prefs";
import { SLOTS, SPAN_CLASS, type SlotChoice } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const viewer = await requireViewer();
  const user = viewer;
  const isAdmin = viewer.role === "ADMIN";

  const [enrollments, favorites, certificates, layout, notifications, news, topics, newsTopics] =
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
      loadLayout(user.id),
      loadNotifications(user.id, viewer),
      loadNewsFeed(user.id, 5, viewer),
      loadTopics(viewer),
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
    where: {
      status: "PUBLISHED",
      id: { notIn: enrolledCourseIds },
      isPrivate: false,
      ...courseAudienceWhere(viewer),
    },
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

  // ---------------------------------------------------- community + messages
  const communityTopics = topicsForAudience(viewer.audience, viewer.role);
  const [communityFeeds, communityCounts, inbox, unread] = await Promise.all([
    Promise.all(
      communityTopics.map((t) => loadFeed(user.id, t.id, isAdmin))
    ),
    loadTopicCounts(),
    loadInbox(user.id),
    loadUnreadCount(user.id),
  ]);
  const feeds: Record<string, FeedPost[]> = {};
  communityTopics.forEach((t, i) => {
    feeds[t.id] = communityFeeds[i];
  });

  const conferences = await loadUpcomingConferences(viewer, 6);
  const resources = await loadResourcesForViewer(viewer);
  const spotlightPartners = await loadSpotlightPartners(viewer);
  const recentPodcasts = await loadRecentPodcasts(viewer, 4);

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
      pricing: e.course.pricing,
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
      pricing: c.pricing,
    };
  });

  const albums = [...enrolledAlbums, ...availableAlbums];
  const inProgress = enrolledAlbums.filter((c) => c.shelf === "assigned");

  const totalUnitsDone = completedSet.size;
  const passRate =
    gradedAttempts > 0 ? Math.round((passedAttempts / gradedAttempts) * 100) : null;
  const firstName = user.name?.trim().split(" ")[0] ?? "Investigator";
  const nextUp = inProgress[0] ?? null;

  // ------------------------------------------------------------ widget map
  function renderWidget(id: SlotChoice) {
    switch (id) {
      case "courses":
        return <CourseAlbum courses={albums} />;

      case "notifications":
        return <NotificationsCard items={notifications} />;

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

      case "resources":
        return (
          <ResourcesCard
            number="06"
            items={resources.map((r) => ({
              id: r.id,
              name: r.name,
              description: r.description,
              url: r.url,
              category: r.category,
            }))}
          />
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

      case "community":
        return (
          <CommunityCard
            feeds={feeds}
            counts={communityCounts}
            isAdmin={isAdmin}
            topics={communityTopics}
            number="08"
          />
        );

      case "messages":
        return <MessagesCard inbox={inbox} unread={unread} number="09" />;

      case "conferences":
        return <ConferencesCard items={conferences} number="10" />;

      case "partners":
        return <PartnersCard items={spotlightPartners} number="11" />;

      case "podcasts":
        return (
          <PodcastsCard
            items={recentPodcasts.map((p) => ({
              id: p.id,
              title: p.title,
              category: p.category,
            }))}
            number="12"
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
            <span className="pill">
              {viewer.audience === "CIVILIAN"
                ? "Private Investigator network"
                : "Case file active"}
            </span>
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
          </div>
        </section>

        {/* -------------------------------------------------- pinned cards --
            "01 My Training" + "02 Dispatch Notifications" are pinned at the top
            and are not customizable (see #9). Everything below is configurable. */}
        <div className="reveal reveal-2 mt-9 grid gap-5 lg:grid-cols-6">
          <div className="lg:col-span-4">
            <CourseAlbum courses={albums} />
          </div>
          <div className="lg:col-span-2">
            <NotificationsCard items={notifications} />
          </div>
        </div>

        {/* ---------------------------------------------------- slot canvas --
            We own the grid geometry; each slot's gear picker lets the learner
            choose which widget fills it (duplicates + Empty allowed). */}
        <div className="reveal reveal-3 mt-5 grid gap-5 lg:grid-cols-6">
          {layout.map((choice, i) => (
            <div key={i} className={SPAN_CLASS[SLOTS[i].span]}>
              <SlotCard index={i} choice={choice}>
                {renderWidget(choice)}
              </SlotCard>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
