import { prisma } from "@/lib/prisma";
import { isAdmin, type AudienceViewer } from "@/lib/audience";
import type { Podcast, Prisma } from "@/generated/prisma";

/**
 * Case-law podcast library. AI-generated audio explainers that translate court
 * rulings into plain-language guidance. Categories are a code-defined list
 * (not a DB enum) so new topics can be added without a migration.
 */

/** Topic buckets, in display order. Add to this list to introduce a category. */
export const PODCAST_CATEGORIES = [
  "ICAC",
  "General Investigations",
  "Sex Offender",
  "Patrol",
] as const;

export type PodcastCategory = (typeof PODCAST_CATEGORIES)[number];

/** Normalize an arbitrary string to a known category, defaulting sensibly. */
export function normalizeCategory(raw: string | null | undefined): PodcastCategory {
  const s = String(raw || "").trim();
  const hit = PODCAST_CATEGORIES.find((c) => c.toLowerCase() === s.toLowerCase());
  return hit ?? "General Investigations";
}

/**
 * Standing disclaimer shown across every podcast surface. Keep the wording in
 * one place so it can't drift between the widget, the library, and the player.
 */
export const PODCAST_DISCLAIMER =
  "These podcasts are AI-generated for informational and entertainment purposes only. They are not legal advice. Always read the underlying ruling and consult your agency's counsel before acting.";

/** Shape consumed by the dashboard widget and library page. */
export interface PodcastView {
  id: string;
  title: string;
  description: string;
  category: string;
  /** Streamed via /api/files/[id]. */
  audioUrl: string;
  rulingUrl: string | null;
  publishedAt: Date;
}

/** Audience gate: admins see all; learners see their side or shared (null). */
function audienceWhere(viewer: AudienceViewer): Prisma.PodcastWhereInput {
  if (isAdmin(viewer)) return {};
  return { OR: [{ audience: viewer.audience }, { audience: null }] };
}

function toView(p: Podcast): PodcastView {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    category: p.category,
    audioUrl:
      (p.audioUrl && p.audioUrl.trim()) ||
      (p.audioFileId ? `/api/files/${p.audioFileId}` : ""),
    rulingUrl: p.rulingUrl,
    publishedAt: p.publishedAt,
  };
}

/** Newest-first ordering used across learner surfaces. */
const LEARNER_ORDER: Prisma.PodcastOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { publishedAt: "desc" },
];

/** Active episodes for a viewer's library page, audience-gated. */
export async function loadPodcastsForViewer(
  viewer: AudienceViewer
): Promise<PodcastView[]> {
  const rows = await prisma.podcast.findMany({
    where: { active: true, ...audienceWhere(viewer) },
    orderBy: LEARNER_ORDER,
  });
  return rows.map(toView);
}

/** A short list of the most recent episodes for the dashboard widget. */
export async function loadRecentPodcasts(
  viewer: AudienceViewer,
  take = 4
): Promise<PodcastView[]> {
  const rows = await prisma.podcast.findMany({
    where: { active: true, ...audienceWhere(viewer) },
    orderBy: [{ publishedAt: "desc" }],
    take,
  });
  return rows.map(toView);
}

/** Every episode — for the admin management list. */
export async function loadAllPodcasts() {
  return prisma.podcast.findMany({
    orderBy: [{ publishedAt: "desc" }, { sortOrder: "asc" }],
  });
}
