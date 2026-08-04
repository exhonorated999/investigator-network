/**
 * Audience gating — the single source of truth for the LE / Civilian split.
 *
 * A learner has exactly one audience (LE or CIVILIAN). Admins are
 * audience-neutral: they see everything. Every learner-facing surface
 * (courses, community, news, direct messages) filters by the viewer's audience
 * so the two sides stay walled off from each other.
 *
 * Keep the filter logic here rather than sprinkling `where` clauses across
 * pages, so the isolation rules can be audited in one place.
 */
import type { Prisma, Audience } from "@/generated/prisma";

export const AUDIENCE_LABEL: Record<Audience, string> = {
  LE: "Law Enforcement",
  CIVILIAN: "Civilian Investigator",
};

export const AUDIENCE_SHORT: Record<Audience, string> = {
  LE: "LE",
  CIVILIAN: "Civilian",
};

/** A viewer whose audience we gate on. Admins bypass all gating. */
export interface AudienceViewer {
  audience: Audience;
  /** "LEARNER" | "ADMIN" — kept as string so session/viewer objects pass
   * without extra casting. Only an exact "ADMIN" match bypasses gating. */
  role: string;
}

export function isAdmin(v: { role: string }): boolean {
  return v.role === "ADMIN";
}

/**
 * Course filter for a viewer. Admins get `{}` (everything). Learners only see
 * courses whose `audiences` array includes their own audience.
 *
 * Note: this does NOT hide private courses — callers that build the public
 * library must add `isPrivate: false` themselves; enrolled/admin views want to
 * see private courses too.
 */
export function courseAudienceWhere(v: AudienceViewer): Prisma.CourseWhereInput {
  if (isAdmin(v)) return {};
  return { audiences: { has: v.audience } };
}

/**
 * User filter for a viewer (used by DM directory + any people search). Admins
 * see all approved users; learners only see approved users on their own side.
 */
export function userAudienceWhere(v: AudienceViewer): Prisma.UserWhereInput {
  if (isAdmin(v)) return {};
  return { audience: v.audience };
}

/**
 * News-article filter for a viewer. Admins see everything. Learners see
 * articles tagged for their own side plus shared articles (audience = null).
 */
export function newsAudienceWhere(
  v: AudienceViewer
): Prisma.NewsArticleWhereInput {
  if (isAdmin(v)) return {};
  return { OR: [{ audience: v.audience }, { audience: null }] };
}
