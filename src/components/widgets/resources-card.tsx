"use client";

import { useMemo, useState } from "react";
import { WidgetCard, WidgetEmpty } from "@/components/widgets/widget-shell";

export interface ResourceItem {
  id: string;
  name: string;
  description: string;
  url: string;
  category: "DFIR" | "INVESTIGATIONS" | "ICAC";
}

const CATEGORIES: { id: ResourceItem["category"]; label: string }[] = [
  { id: "DFIR", label: "DFIR" },
  { id: "INVESTIGATIONS", label: "Investigations" },
  { id: "ICAC", label: "ICAC" },
];

/** Free tools & resources — category-toggled list of external links. */
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
  const [active, setActive] = useState<ResourceItem["category"]>(firstWithItems);

  const counts = useMemo(() => {
    const m: Record<ResourceItem["category"], number> = {
      DFIR: 0,
      INVESTIGATIONS: 0,
      ICAC: 0,
    };
    for (const r of items) m[r.category] += 1;
    return m;
  }, [items]);

  const shown = items.filter((r) => r.category === active);

  return (
    <WidgetCard number={number} eyebrow="Field kit" title="Tools & resources" count={items.length}>
      {items.length === 0 ? (
        <WidgetEmpty>No resources yet.</WidgetEmpty>
      ) : (
        <div>
          {/* Category toggle */}
          <div className="flex flex-wrap gap-1.5">
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

          {/* Resource list for the active category */}
          <div className="mt-4">
            {shown.length === 0 ? (
              <p className="text-[14px] text-muted">
                No resources in this category yet.
              </p>
            ) : (
              shown.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] text-foreground">{r.name}</p>
                    {r.description ? (
                      <p className="mt-0.5 text-[13px] leading-snug text-muted">
                        {r.description}
                      </p>
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
              ))
            )}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
