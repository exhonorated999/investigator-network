/**
 * Community feed — a topic-tabbed social wall where members post questions,
 * answer each other (threaded), and react with a small fixed set of reactions.
 *
 * Topics are a code-level constant, independent of the course/news `Category`
 * table, so the community taxonomy can evolve on its own. To add a topic, add
 * an entry here; existing posts keep their stored `topic` string.
 */
import { prisma } from "@/lib/prisma";

// Client-safe constants, types, and pure helpers live in a prisma-free module
// so client components (e.g. the community card) can import them without
// pulling the Prisma client into the browser bundle. Re-exported here so every
// existing server-side caller of `@/lib/community` keeps working unchanged.
export {
  COMMUNITY_TOPICS,
  topicsForAudience,
  canAccessTopic,
  DEFAULT_TOPIC,
  isTopic,
  topicLabel,
  REACTIONS,
  isReactionKind,
  timeAgo,
} from "@/lib/community-shared";
export type {
  CommunityTopic,
  Author,
  ReactionSummary,
  FeedComment,
  FeedPost,
} from "@/lib/community-shared";

import {
  REACTIONS,
  timeAgo,
  type Author,
  type ReactionSummary,
  type FeedComment,
  type FeedPost,
} from "@/lib/community-shared";

// --------------------------------------------------------------- utilities --

const AUTHOR_SELECT = {
  id: true,
  name: true,
  agency: true,
  role: true,
} as const;

type RawReaction = { kind: string; userId: string };

function summarise(
  reactions: RawReaction[],
  viewerId: string
): ReactionSummary[] {
  return REACTIONS.map((r) => {
    const mine = reactions.some(
      (x) => x.kind === r.kind && x.userId === viewerId
    );
    const count = reactions.filter((x) => x.kind === r.kind).length;
    return { kind: r.kind, count, mine };
  }).filter((r) => r.count > 0 || r.mine);
}

// ----------------------------------------------------------------- loaders --

type CommentRow = {
  id: string;
  body: string;
  hidden: boolean;
  parentId: string | null;
  createdAt: Date;
  author: Author;
  reactions: RawReaction[];
};

/** Build a nested comment tree from a flat, chronologically-sorted list. */
function buildTree(rows: CommentRow[], viewerId: string): FeedComment[] {
  const nodes = new Map<string, FeedComment>();
  for (const r of rows) {
    nodes.set(r.id, {
      id: r.id,
      body: r.body,
      author: r.author,
      ago: timeAgo(r.createdAt),
      hidden: r.hidden,
      reactions: summarise(r.reactions, viewerId),
      replies: [],
    });
  }
  const roots: FeedComment[] = [];
  for (const r of rows) {
    const node = nodes.get(r.id)!;
    if (r.parentId && nodes.has(r.parentId)) {
      nodes.get(r.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/**
 * Latest posts in a topic, newest first, with author, reaction summaries and a
 * threaded comment tree. Hidden posts/comments are excluded for learners but
 * surfaced (flagged) for admins so moderation is reversible.
 */
export async function loadFeed(
  viewerId: string,
  topic: string,
  isAdmin: boolean,
  limit = 40
): Promise<FeedPost[]> {
  const posts = await prisma.post.findMany({
    where: { topic, ...(isAdmin ? {} : { hidden: false }) },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      author: { select: AUTHOR_SELECT },
      reactions: { select: { kind: true, userId: true } },
      comments: {
        where: isAdmin ? {} : { hidden: false },
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: AUTHOR_SELECT },
          reactions: { select: { kind: true, userId: true } },
        },
      },
    },
  });

  return posts.map((p) => {
    const tree = buildTree(p.comments as CommentRow[], viewerId);
    return {
      id: p.id,
      topic: p.topic,
      body: p.body,
      imageUrl: p.imageUrl,
      author: p.author,
      ago: timeAgo(p.createdAt),
      hidden: p.hidden,
      reactions: summarise(p.reactions, viewerId),
      comments: tree,
      commentCount: p.comments.filter((c) => !c.hidden).length,
    };
  });
}

/** Post + comment counts per topic, for the tab badges. */
export async function loadTopicCounts(): Promise<Record<string, number>> {
  const grouped = await prisma.post.groupBy({
    by: ["topic"],
    where: { hidden: false },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const g of grouped) out[g.topic] = g._count._all;
  return out;
}
