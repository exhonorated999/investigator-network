import Link from "next/link";
import { requireViewer } from "@/lib/viewer";
import { SiteHeader } from "@/components/site-header";
import { MessagesCard } from "@/components/widgets/messages-card";
import { loadInbox, loadUnreadCount } from "@/lib/messages";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const viewer = await requireViewer();
  const isAdmin = viewer.role === "ADMIN";

  const [inbox, unread] = await Promise.all([
    loadInbox(viewer.id),
    loadUnreadCount(viewer.id),
  ]);

  return (
    <div className="min-h-screen">
      <SiteHeader name={viewer.name} isAdmin={isAdmin} />

      <main className="mx-auto max-w-3xl px-5 pb-20 pt-8">
        <section className="reveal reveal-1 flex flex-wrap items-end justify-between gap-5">
          <div>
            <span className="pill">Direct comms</span>
            <h1 className="display-lg mt-4">Messages</h1>
            <p className="mt-3 max-w-2xl text-[17px] text-muted">
              Private, one-to-one conversations with peers and instructors.
            </p>
          </div>
          <Link href="/dashboard" className="btn btn-ghost btn-sm">
            Dashboard
          </Link>
        </section>

        <div className="reveal reveal-2 mt-7">
          <MessagesCard inbox={inbox} unread={unread} variant="page" />
        </div>
      </main>
    </div>
  );
}
