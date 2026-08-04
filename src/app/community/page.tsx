import Link from "next/link";
import { requireViewer } from "@/lib/viewer";
import { SiteHeader } from "@/components/site-header";
import { CommunityCard } from "@/components/widgets/community-card";
import {
  topicsForAudience,
  loadFeed,
  loadTopicCounts,
  type FeedPost,
} from "@/lib/community";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const viewer = await requireViewer();
  const isAdmin = viewer.role === "ADMIN";
  const topics = topicsForAudience(viewer.audience, viewer.role);

  const [perTopic, counts] = await Promise.all([
    Promise.all(topics.map((t) => loadFeed(viewer.id, t.id, isAdmin))),
    loadTopicCounts(),
  ]);
  const feeds: Record<string, FeedPost[]> = {};
  topics.forEach((t, i) => {
    feeds[t.id] = perTopic[i];
  });

  return (
    <div className="min-h-screen">
      <SiteHeader name={viewer.name} isAdmin={isAdmin} />

      <main className="mx-auto max-w-3xl px-5 pb-20 pt-8">
        <section className="reveal reveal-1 flex flex-wrap items-end justify-between gap-5">
          <div>
            <span className="pill">Members only</span>
            <h1 className="display-lg mt-4">The Wire</h1>
            <p className="mt-3 max-w-2xl text-[17px] text-muted">
              Ask questions, share tradecraft and help other investigators —
              organised by discipline.
            </p>
          </div>
          <Link href="/dashboard" className="btn btn-ghost btn-sm">
            Dashboard
          </Link>
        </section>

        <div className="reveal reveal-2 mt-7">
          <CommunityCard
            feeds={feeds}
            counts={counts}
            isAdmin={isAdmin}
            topics={topics}
            variant="page"
          />
        </div>
      </main>
    </div>
  );
}
