import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireViewer } from "@/lib/viewer";
import { boardEnabled } from "@/lib/board-config";
import { canAccessBoard, loadBoardPost, markBoardRead } from "@/lib/board";
import { loadCourseBySlug, flattenUnits } from "@/lib/course";
import { BoardPostStandalone } from "@/components/board/board-post-card";

export const dynamic = "force-dynamic";

/**
 * A single class-board thread. This is where dashboard notifications land, so
 * a learner can read the post and reply without opening the course player.
 */
export default async function BoardPostPage({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}) {
  const { slug, postId } = await params;
  const user = await requireViewer();
  const isAdmin = user.role === "ADMIN";
  if (!boardEnabled(slug)) notFound();

  const course = await prisma.course.findUnique({
    where: { slug },
    select: { id: true, title: true },
  });
  if (!course) notFound();
  if (!(await canAccessBoard(user.id, user.role, course.id))) {
    redirect(`/courses/${slug}`);
  }

  const post = await loadBoardPost(postId, user.id);
  const full = await loadCourseBySlug(slug);
  const firstUnit = full ? flattenUnits(full)[0] : undefined;
  const boardHref = firstUnit
    ? `/courses/${slug}/units/${firstUnit.id}?board=${post && post.courseId === course.id ? post.id : "1"}`
    : `/courses/${slug}`;

  // Capture what was new before marking it read, so flags show on this visit.
  const newIds: string[] = [];
  if (post && post.courseId === course.id) {
    if (post.isNew) newIds.push(post.id);
    for (const r of post.replies) if (r.isNew) newIds.push(r.id);
    await markBoardRead(user.id, [post.id]);
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <Link href="/dashboard" className="eyebrow eyebrow-muted hover:text-accent-bright">
          ← Dashboard
        </Link>
        <Link href={boardHref} className="btn btn-ghost btn-sm">
          💬 Open class board
        </Link>
      </div>

      <p className="eyebrow eyebrow-gold mt-8 text-[10px]">Class Board</p>
      <h1 className="display-sm mt-1">{course.title}</h1>

      <div className="mt-6">
        {post && post.courseId === course.id ? (
          <BoardPostStandalone
            post={post}
            viewer={{ id: user.id, isAdmin }}
            newIds={newIds}
          />
        ) : (
          <div className="panel p-6 text-sm text-muted">
            This post is no longer available. It may have been removed.
          </div>
        )}
      </div>
    </div>
  );
}
