/**
 * Community feed — a topic-tabbed social wall where members post questions,
 * answer each other (threaded), and react with a small fixed set of reactions.
 *
 * Topics are a code-level constant, independent of the course/news `Category`
 * table, so the community taxonomy can evolve on its own. To add a topic, add
 * an entry here; existing posts keep their stored `topic` string.
 */
import { prisma } from "@/lib/prisma";
import type { Role, Audience } from "@/generated/prisma";

export interface CommunityTopic {
  id: string;
  label: string;
  blurb: string;
  /** Which side of the platform this topic belongs to. */
  audience: Audience;
}

export const COMMUNITY_TOPICS: CommunityTopic[] = [
  {
    id: "DFIR",
    label: "DFIR",
    blurb: "Digital forensics & incident response",
    audience: "LE",
  },
  {
    id: "ICAC",
    label: "ICAC",
    blurb: "Internet crimes against children",
    audience: "LE",
  },
  {
    id: "GENERAL",
    label: "General Investigations",
    blurb: "Case work, interviews, evidence & everything else",
    audience: "LE",
  },
  {
    id: "CDFIR",
    label: "CDFIR",
    blurb: "Civilian digital forensics & incident response",
    audience: "CIVILIAN",
  },
  {
    id: "PRIVATE_INVESTIGATIONS",
    label: "Private Investigations",
    blurb: "Licensing, surveillance, case work & the PI trade",
    audience: "CIVILIAN",
  },
];

/** Topics visible to a viewer. Admins see all; learners see their side only. */
export function topicsForAudience(
  audience: Audience,
  role: string
): CommunityTopic[] {
  if (role === "ADMIN") return COMMUNITY_TOPICS;
  return COMMUNITY_TOPICS.filter((t) => t.audience === audience);
}

/** True when a viewer is allowed to read/post in a given topic. */
export function canAccessTopic(
  topicId: string,
  audience: Audience,
  role: string
): boolean {
  if (role === "ADMIN") return true;
  const t = COMMUNITY_TOPICS.find((x) => x.id === topicId);
  return !!t && t.audience === audience;
}

export const DEFAULT_TOPIC = COMMUNITY_TOPICS[0].id;

const TOPIC_IDS = new Set(COMMUNITY_TOPICS.map((t) => t.id));

export function isTopic(value: string): boolean {
  return TOPIC_IDS.has(value);
}

export function topicLabel(id: string): string {
  return COMMUNITY_TOPICS.find((t) => t.id === id)?.label ?? id;
}

/** The fixed reaction palette. Order = display order in the reaction bar. */
export const REACTIONS: { kind: string; emoji: string; label: string }[] = [
  { kind: "helpful", emoji: "👍", label: "Helpful" },
  { kind: "insightful", emoji: "💡", label: "Insightful" },
  { kind: "thanks", emoji: "🙏", label: "Thanks" },
];

const REACTION_KINDS = new Set(REACTIONS.map((r) => r.kind));

export function isReactionKind(value: string): boolean {
  return REACTION_KINDS.has(value);
}

// ------------------------------------------------------------------- types --

export interface Author {
  id: string;
  name: string;
  agency: string;
  role: Role;
}

export interface ReactionSummary {
  kind: string;
  count: number;
  /** True when the current viewer contributed this reaction. */
  mine: boolean;
}

export interface FeedComment {
  id: string;
  body: string;
  author: Author;
  ago: string;
  hidden: boolean;
  reactions: ReactionSummary[];
  replies: FeedComment[];
}

export interface FeedPost {
  id: string;
  topic: string;
  body: string;
  imageUrl: string | null;
  author: Author;
  ago: string;
  hidden: boolean;
  reactions: ReactionSummary[];
  comments: FeedComment[];
  commentCount: number;
}

// --------------------------------------------------------------- utilities --

const AUTHOR_SELECT = {
  id: true,
  name: true,
  agency: true,
  role: true,
} as const;

/** Compact relative-time label, e.g. "just now", "4m", "3h", "2d", "Aug 3". */
export function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 45) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

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
