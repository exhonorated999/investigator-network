/**
 * Community feed — client-safe constants, types, and pure helpers.
 *
 * This module deliberately imports NO server-only code (no `@/lib/prisma`), so
 * it can be pulled into client components (e.g. the community card) without
 * dragging the Prisma client into the browser bundle. The data loaders that do
 * touch the database live in `@/lib/community`, which re-exports everything
 * here for server-side callers.
 *
 * Topics are a code-level constant, independent of the course/news `Category`
 * table, so the community taxonomy can evolve on its own. To add a topic, add
 * an entry here; existing posts keep their stored `topic` string.
 */
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
