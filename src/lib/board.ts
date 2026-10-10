import { prisma } from "@/lib/prisma";
import { BOARD_COURSES } from "@/lib/board-config";

/**
 * Class board loaders + unread rules.
 *
 * Unread rules for a viewer:
 *  - A post is NEW when someone else wrote it and the viewer has never opened it.
 *  - A reply only counts toward the viewer's alerts when they are part of the
 *    thread (wrote the post or replied in it) and the reply is newer than the
 *    viewer's last read of that post.
 * Viewing a post (panel open / post page) upserts BoardRead and clears both.
 */

export interface BoardReplyView {
  id: string;
  body: string;
  staff: boolean;
  createdAt: string;
  isNew: boolean;
  author: { id: string; name: string };
}

export interface BoardPostView {
  id: string;
  kind: string;
  title: string | null;
  body: string;
  linkUrl: string | null;
  agency: string | null;
  contactEmail: string | null;
  file: { id: string; filename: string; sizeBytes: number } | null;
  createdAt: string;
  lastActivityAt: string;
  author: { id: string; name: string; agency: string; isStaff: boolean };
  replies: BoardReplyView[];
  /** The post itself has never been opened by the viewer. */
  isNew: boolean;
  /** New replies in a thread the viewer participates in. */
  newReplies: number;
  /** Counts toward the viewer's unread badge. */
  unread: boolean;
}

const POST_INCLUDE = (userId: string) =>
  ({
    author: { select: { id: true, name: true, agency: true, role: true } },
    file: { select: { id: true, filename: true, sizeBytes: true } },
    replies: {
      where: { hidden: false },
      orderBy: { createdAt: "asc" as const },
      include: { author: { select: { id: true, name: true } } },
    },
    reads: { where: { userId }, select: { readAt: true } },
  }) as const;

type RawPost = Awaited<ReturnType<typeof rawPosts>>[number];

function rawPosts(where: object, userId: string) {
  return prisma.boardPost.findMany({
    where: { ...where, hidden: false },
    orderBy: { lastActivityAt: "desc" },
    include: POST_INCLUDE(userId),
  });
}

function toView(p: RawPost, userId: string): BoardPostView {
  const readAt = p.reads[0]?.readAt ?? null;
  const mine = p.authorId === userId;
  const isNew = !mine && !readAt;
  const participant = mine || p.replies.some((r) => r.authorId === userId);

  const replies: BoardReplyView[] = p.replies.map((r) => ({
    id: r.id,
    body: r.body,
    staff: r.staff,
    createdAt: r.createdAt.toISOString(),
    isNew: r.authorId !== userId && (!readAt || r.createdAt > readAt),
    author: { id: r.author.id, name: r.author.name },
  }));
  const newReplies = participant
    ? p.replies.filter(
        (r) => r.authorId !== userId && (!readAt || r.createdAt > readAt)
      ).length
    : 0;

  return {
    id: p.id,
    kind: p.kind,
    title: p.title,
    body: p.body,
    linkUrl: p.linkUrl,
    agency: p.agency,
    contactEmail: p.contactEmail,
    file: p.file,
    createdAt: p.createdAt.toISOString(),
    lastActivityAt: p.lastActivityAt.toISOString(),
    author: {
      id: p.author.id,
      name: p.author.name,
      agency: p.author.agency,
      isStaff: p.author.role === "ADMIN",
    },
    replies,
    isNew,
    newReplies,
    unread: isNew || newReplies > 0,
  };
}

/** Every visible post on one course's board, most recently active first. */
export async function loadBoard(
  courseId: string,
  userId: string
): Promise<BoardPostView[]> {
  const posts = await rawPosts({ courseId }, userId);
  return posts.map((p) => toView(p, userId));
}

/** One post (visible), or null. */
export async function loadBoardPost(
  postId: string,
  userId: string
): Promise<(BoardPostView & { courseId: string }) | null> {
  const posts = await rawPosts({ id: postId }, userId);
  const p = posts[0];
  return p ? { ...toView(p, userId), courseId: p.courseId } : null;
}

/** Enrolled learners and admins may read and post. */
export async function canAccessBoard(
  userId: string,
  role: string | undefined,
  courseId: string
): Promise<boolean> {
  if (role === "ADMIN") return true;
  const e = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  return !!e;
}

/** Mark posts as viewed now (clears NEW flags + dashboard alerts). */
export async function markBoardRead(userId: string, postIds: string[]) {
  const ids = [...new Set(postIds)].filter(Boolean);
  if (!ids.length) return;
  const now = new Date();
  await prisma.boardRead.updateMany({
    where: { userId, postId: { in: ids } },
    data: { readAt: now },
  });
  await prisma.boardRead.createMany({
    data: ids.map((postId) => ({ userId, postId, readAt: now })),
    skipDuplicates: true,
  });
}

export interface BoardAlert {
  postId: string;
  courseSlug: string;
  courseTitle: string;
  kind: string;
  /** "post" = a new post; "reply" = new replies in the viewer's thread. */
  type: "post" | "reply";
  title: string;
  snippet: string;
  by: string;
  at: Date;
}

/**
 * Unread board activity across every board-enabled course the user can see
 * (enrolled courses; admins see all boards). Powers dashboard notifications.
 */
export async function loadBoardAlerts(
  userId: string,
  isAdmin: boolean
): Promise<BoardAlert[]> {
  const slugs = [...BOARD_COURSES];
  if (!slugs.length) return [];
  const posts = await prisma.boardPost.findMany({
    where: {
      hidden: false,
      course: {
        slug: { in: slugs },
        ...(isAdmin ? {} : { enrollments: { some: { userId } } }),
      },
    },
    orderBy: { lastActivityAt: "desc" },
    take: 200,
    include: {
      ...POST_INCLUDE(userId),
      course: { select: { slug: true, title: true } },
    },
  });

  const out: BoardAlert[] = [];
  for (const p of posts) {
    const v = toView(p, userId);
    if (!v.unread) continue;
    const titleText = p.title?.trim() || p.body.trim().slice(0, 80);
    if (v.isNew) {
      out.push({
        postId: p.id,
        courseSlug: p.course.slug,
        courseTitle: p.course.title,
        kind: p.kind,
        type: "post",
        title: titleText,
        snippet: p.body.trim().slice(0, 140),
        by: p.author.name,
        at: p.createdAt,
      });
    } else {
      const fresh = v.replies.filter((r) => r.isNew);
      const last = fresh[fresh.length - 1];
      if (!last) continue;
      out.push({
        postId: p.id,
        courseSlug: p.course.slug,
        courseTitle: p.course.title,
        kind: p.kind,
        type: "reply",
        title: titleText,
        snippet: last.body.trim().slice(0, 140),
        by: last.author.name,
        at: new Date(last.createdAt),
      });
    }
  }
  return out;
}
