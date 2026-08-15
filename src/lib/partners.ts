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
    logoUrl:
      (p.logoUrl && p.logoUrl.trim()) ||
      (p.logoFileId ? `/api/files/${p.logoFileId}` : null),
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

export interface PartnerClickStat {
  partnerId: string;
  month: number;
  quarter: number;
  year: number;
  allTime: number;
}

/**
 * Per-partner click counts bucketed for the current month / quarter / year,
 * plus all-time — the numbers an admin shows a sponsor to demonstrate ROI.
 * Month/quarter/year are calendar-to-date from the same start-of-year fetch;
 * all-time is a separate aggregate so historical clicks are included.
 */
export async function loadPartnerClickStats(): Promise<Map<string, PartnerClickStat>> {
  const now = new Date();
  const y = now.getFullYear();
  const startOfYear = new Date(y, 0, 1);
  const startOfQuarter = new Date(y, Math.floor(now.getMonth() / 3) * 3, 1);
  const startOfMonth = new Date(y, now.getMonth(), 1);

  const [allTime, yearRows] = await Promise.all([
    prisma.partnerClick.groupBy({ by: ["partnerId"], _count: { _all: true } }),
    prisma.partnerClick.findMany({
      where: { clickedAt: { gte: startOfYear } },
      select: { partnerId: true, clickedAt: true },
    }),
  ]);

  const map = new Map<string, PartnerClickStat>();
  const ensure = (id: string) => {
    let s = map.get(id);
    if (!s) {
      s = { partnerId: id, month: 0, quarter: 0, year: 0, allTime: 0 };
      map.set(id, s);
    }
    return s;
  };

  for (const g of allTime) ensure(g.partnerId).allTime = g._count._all;
  for (const r of yearRows) {
    const s = ensure(r.partnerId);
    s.year++;
    if (r.clickedAt >= startOfQuarter) s.quarter++;
    if (r.clickedAt >= startOfMonth) s.month++;
  }
  return map;
}
