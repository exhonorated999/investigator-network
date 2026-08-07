import { prisma } from "@/lib/prisma";
import { isAdmin, type AudienceViewer } from "@/lib/audience";
import type { Prisma, ResourceCategory } from "@/generated/prisma";

/** The three learner-facing resource categories, in display order. */
export const RESOURCE_CATEGORIES: { id: ResourceCategory; label: string }[] = [
  { id: "DFIR", label: "DFIR" },
  { id: "INVESTIGATIONS", label: "Investigations" },
  { id: "ICAC", label: "ICAC" },
];

export const RESOURCE_CATEGORY_LABEL: Record<ResourceCategory, string> = {
  DFIR: "DFIR",
  INVESTIGATIONS: "Investigations",
  ICAC: "ICAC",
};

/** Audience gate: admins see all; learners see their side or shared (null). */
function audienceWhere(viewer: AudienceViewer): Prisma.ResourceWhereInput {
  if (isAdmin(viewer)) return {};
  return { OR: [{ audience: viewer.audience }, { audience: null }] };
}

/** Resources for a viewer's dashboard card, audience-gated (admins see all). */
export async function loadResourcesForViewer(viewer: AudienceViewer) {
  return prisma.resource.findMany({
    where: audienceWhere(viewer),
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
}

/** Every resource — for the admin management list. */
export async function loadAllResources() {
  return prisma.resource.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
}
