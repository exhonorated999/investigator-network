import { prisma } from "@/lib/prisma";
import { isAdmin, type AudienceViewer } from "@/lib/audience";
import type { Partner, Prisma, PartnerTier } from "@/generated/prisma";

/** Partner tiers, in display order (Featured surfaces first). */
export const PARTNER_TIERS: { id: PartnerTier; label: string }[] = [
  { id: "FEATURED", label: "Featured" },
  { id: "STANDARD", label: "Standard" },
];

export const PARTNER_TIER_LABEL: Record<PartnerTier, string> = {
  FEATURED: "Featured",
  STANDARD: "Standard",
};

/** Shape consumed by the dashboard widget and directory page. */
export interface PartnerView {
  id: string;
  name: string;
  blurb: string;
  url: string;
  tier: PartnerTier;
  /** Resolved logo URL (served via /api/files/[id]) or null. */
  logoUrl: string | null;
}

/** Audience gate: admins see all; learners see their side or shared (null). */
function audienceWhere(viewer: AudienceViewer): Prisma.PartnerWhereInput {
  if (isAdmin(viewer)) return {};
  return { OR: [{ audience: viewer.audience }, { audience: null }] };
}

function toView(p: Partner): PartnerView {
  return {
    id: p.id,
    name: p.name,
    blurb: p.blurb,
    url: p.url,
    tier: p.tier,
    logoUrl: p.logoFileId ? `/api/files/${p.logoFileId}` : null,
  };
}

/** FEATURED-first ordering used across learner surfaces. */
const LEARNER_ORDER: Prisma.PartnerOrderByWithRelationInput[] = [
  { tier: "asc" }, // FEATURED sorts before STANDARD alphabetically
  { sortOrder: "asc" },
  { name: "asc" },
];

/** Active partners for a viewer's directory page, audience-gated. */
export async function loadPartnersForViewer(
  viewer: AudienceViewer
): Promise<PartnerView[]> {
  const rows = await prisma.partner.findMany({
    where: { active: true, ...audienceWhere(viewer) },
    orderBy: LEARNER_ORDER,
  });
  return rows.map(toView);
}

/**
 * Partners for the rotating spotlight widget. Prefers FEATURED; if none are
 * featured yet, falls back to any active partner so the widget is never empty
 * when partners exist.
 */
export async function loadSpotlightPartners(
  viewer: AudienceViewer
): Promise<PartnerView[]> {
  const featured = await prisma.partner.findMany({
    where: { active: true, tier: "FEATURED", ...audienceWhere(viewer) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  if (featured.length > 0) return featured.map(toView);

  const anyActive = await prisma.partner.findMany({
    where: { active: true, ...audienceWhere(viewer) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return anyActive.map(toView);
}

/** Every partner — for the admin management list. */
export async function loadAllPartners() {
  return prisma.partner.findMany({
    orderBy: [{ tier: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
}
