// Prisma-free: shared by the dashboard card (client) and admin pages.
// Sub-headings ("sections") inside each resource category, in display order.
// A resource's `group` is free text; groups not listed here sort after these
// alphabetically, and an empty group renders last as "Other".

export type ResourceCategoryId = "DFIR" | "INVESTIGATIONS" | "ICAC";

export const RESOURCE_GROUPS: Record<ResourceCategoryId, string[]> = {
  DFIR: [
    "Forensic tools",
    "Training & certification",
    "Blogs & self-study",
    "Community & podcasts",
    "Standards & best practices",
  ],
  INVESTIGATIONS: [
    "People & accounts",
    "Phones, IPs & domains",
    "Images & media",
    "Cryptocurrency",
    "Capture & preservation",
    "Legal process",
    "Toolkits & training",
  ],
  ICAC: [
    "Task force & case tools",
    "P2P & network tools",
    "Statutes & legal guidance",
    "Organizations & nonprofits",
    "Victim support & image removal",
    "Prevention & education",
    "Research & statistics",
  ],
};

export const OTHER_GROUP_LABEL = "Other";

/** Bucket items into ordered sections for one category. */
export function groupResources<T extends { group: string }>(
  category: ResourceCategoryId,
  items: T[],
): { label: string; items: T[] }[] {
  const known = RESOURCE_GROUPS[category] ?? [];
  const buckets = new Map<string, T[]>();
  for (const it of items) {
    const g = it.group.trim();
    const list = buckets.get(g) ?? [];
    list.push(it);
    buckets.set(g, list);
  }
  const rank = (g: string) => {
    if (!g) return Number.MAX_SAFE_INTEGER;
    const i = known.findIndex((k) => k.toLowerCase() === g.toLowerCase());
    return i === -1 ? known.length : i;
  };
  return [...buckets.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([g, list]) => ({ label: g || OTHER_GROUP_LABEL, items: list }));
}
