"use client";

import { useMemo, useState } from "react";
import { WidgetCard, WidgetEmpty } from "@/components/widgets/widget-shell";
import { groupResources, type ResourceCategoryId } from "@/lib/resource-groups";

export interface ResourceItem {
  id: string;
  name: string;
  description: string;
  url: string;
  category: ResourceCategoryId;
  /** Sub-heading within the category ("" = Other). */
  group: string;
}

const CATEGORIES: { id: ResourceCategoryId; label: string }[] = [
  { id: "DFIR", label: "DFIR" },
  { id: "INVESTIGATIONS", label: "Investigations" },
  { id: "ICAC", label: "ICAC" },
];

function ResourceRow({ r }: { r: ResourceItem }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[15px] text-foreground">{r.name}</p>
        {r.description ? (
          <p className="mt-0.5 text-[13px] leading-snug text-muted">{r.description}</p>
        ) : null}
      </div>
      <a
        href={r.url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost btn-sm shrink-0"
      >
        Open ↗
      </a>
    </div>
  );
}

function SectionHeading({ label, count, first }: { label: string; count: number; first?: boolean }) {
  return (
    <p
      className={`${first ? "mt-1" : "mt-5"} border-b border-border-strong pb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-accent-bright`}
    >
      {label}
      <span className="ml-1.5 text-muted">{count}</span>
    </p>
  );
}

/** Free tools & resources — searchable, category-toggled, sectioned list. */
export function ResourcesCard({
  items,
  number = "06",
}: {
  items: ResourceItem[];
  number?: string;
}) {
  // Default to the first category that actually has resources.
  const firstWithItems =
    CATEGORIES.find((c) => items.some((r) => r.category === c.id))?.id ?? "DFIR";
  const [active, setActive] = useState<ResourceCategoryId>(firstWithItems);
  const [query, setQuery] = useState("");

  const terms = useMemo(
    () => query.toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  );
  const searching = terms.length > 0;

  // Search spans every category (name, description, section).
  const matches = useMemo(() => {
    if (!searching) return items;
    return items.filter((r) => {
      const hay = `${r.name} ${r.description} ${r.group}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [items, terms, searching]);

  const counts = useMemo(() => {
    const m: Record<ResourceCategoryId, number> = { DFIR: 0, INVESTIGATIONS: 0, ICAC: 0 };
    for (const r of matches) m[r.category] += 1;
    return m;
  }, [matches]);

  const sections = useMemo(
    () => groupResources(active, items.filter((r) => r.category === active)),
    [items, active],
  );

  return (
    <WidgetCard number={number} eyebrow="Field kit" title="Tools & resources" count={items.length}>
      {items.length === 0 ? (
        <WidgetEmpty>No resources yet.</WidgetEmpty>
      ) : (
        <div>
          {/* Sticky search + category toggle — stay visible while the list scrolls. */}
          <div className="sticky top-0 z-10 bg-surface pb-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all tools & resources…"
              aria-label="Search tools and resources"
              className="field !py-1.5 !text-[14px]"
            />
            {searching ? (
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                {matches.length} of {items.length} match
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => {
                  const on = c.id === active;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActive(c.id)}
                      className={`border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
                        on
                          ? "border-accent-bright bg-[rgba(0,180,216,0.1)] text-accent-bright"
                          : "border-border text-muted hover:border-border-strong hover:text-foreground"
                      }`}
                    >
                      {c.label}
                      <span className="ml-1.5 opacity-70">{counts[c.id]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-2">
            {searching ? (
              matches.length === 0 ? (
                <WidgetEmpty>No resources match “{query.trim()}”.</WidgetEmpty>
              ) : (
                // Results grouped by category so the context is clear.
                CATEGORIES.filter((c) => counts[c.id] > 0).map((c, i) => (
                  <div key={c.id}>
                    <SectionHeading label={c.label} count={counts[c.id]} first={i === 0} />
                    {matches
                      .filter((r) => r.category === c.id)
                      .map((r) => (
                        <ResourceRow key={r.id} r={r} />
                      ))}
                  </div>
                ))
              )
            ) : sections.length === 0 ? (
              <p className="text-[14px] text-muted">No resources in this category yet.</p>
            ) : (
              sections.map((s, i) => (
                <div key={s.label}>
                  {/* Skip the heading when everything is ungrouped. */}
                  {sections.length > 1 || s.label !== "Other" ? (
                    <SectionHeading label={s.label} count={s.items.length} first={i === 0} />
                  ) : null}
                  {s.items.map((r) => (
                    <ResourceRow key={r.id} r={r} />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
