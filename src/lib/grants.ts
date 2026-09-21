import { prisma } from "@/lib/prisma";
import type { GrantCategory } from "@/generated/prisma";

/**
 * LE funding-opportunity directory. Admins post a grant (URL + auto-filled
 * details); approved Law-Enforcement members see published grants on the
 * "Grants" dashboard card. Civilians never see this data.
 */

// Category labels/order live in a prisma-free module so client components can
// import them without bundling the Prisma client. Re-exported here for the
// server-side callers that already import from `@/lib/grants`.
export { GRANT_CATEGORY_LABEL, GRANT_CATEGORIES } from "@/lib/grant-categories";

export interface GrantItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  grantingAgency: string;
  qualifyingAgency: string;
  dueDate: string | null; // ISO
  categories: GrantCategory[];
}

function toItem(g: {
  id: string;
  title: string;
  summary: string;
  url: string;
  grantingAgency: string;
  qualifyingAgency: string;
  dueDate: Date | null;
  categories: GrantCategory[];
}): GrantItem {
  return {
    id: g.id,
    title: g.title,
    summary: g.summary,
    url: g.url,
    grantingAgency: g.grantingAgency,
    qualifyingAgency: g.qualifyingAgency,
    dueDate: g.dueDate ? g.dueDate.toISOString() : null,
    categories: g.categories,
  };
}

/**
 * Published grants for the learner card. Soonest due date first (grants with no
 * due date sink to the bottom), so the most time-sensitive opportunities lead.
 */
export async function loadPublishedGrants(limit = 20): Promise<GrantItem[]> {
  const rows = await prisma.grant.findMany({
    where: { published: true },
    orderBy: [{ createdAt: "desc" }],
  });
  const items = rows.map(toItem);
  return items
    .sort((a, b) => {
      const da = a.dueDate ? Date.parse(a.dueDate) : Infinity;
      const db = b.dueDate ? Date.parse(b.dueDate) : Infinity;
      return da - db;
    })
    .slice(0, limit);
}

/** All grants for the admin console, newest first. */
export async function loadAllGrants() {
  const rows = await prisma.grant.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map((g) => ({ ...toItem(g), published: g.published }));
}
