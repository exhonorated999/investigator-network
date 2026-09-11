"use client";

import { useMemo, useState } from "react";
import { WidgetCard, WidgetEmpty } from "@/components/widgets/widget-shell";

export interface IspItem {
  id: string;
  name: string;
  url: string;
  email: string;
  note: string;
}

/**
 * Service of Process directory — alphabetized list of ISPs / platforms and
 * where to serve legal process. A small type-ahead filter keeps a long list
 * usable inside the compact dashboard card.
 */
export function IspCard({
  items,
  number = "13",
}: {
  items: IspItem[];
  number?: string;
}) {
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? items.filter((i) => i.name.toLowerCase().includes(needle))
      : items;
    // Server already sorts, but keep it defensive for the filtered view.
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }, [items, q]);

  return (
    <WidgetCard
      number={number}
      eyebrow="Service of process"
      title="ISP directory"
      count={items.length}
    >
      {items.length === 0 ? (
        <WidgetEmpty>No providers listed yet.</WidgetEmpty>
      ) : (
        <div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter providers…"
            className="field w-full text-[13px]"
          />
          <div className="mt-3 max-h-72 overflow-auto">
            {shown.length === 0 ? (
              <p className="text-[14px] text-muted">No match.</p>
            ) : (
              shown.map((i) => (
                <div
                  key={i.id}
                  className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] text-foreground">{i.name}</p>
                    {i.email ? (
                      <p className="mt-0.5 break-all font-mono text-[12px] text-muted">
                        {i.email}
                      </p>
                    ) : null}
                    {i.note ? (
                      <p className="mt-0.5 text-[13px] leading-snug text-muted">{i.note}</p>
                    ) : null}
                  </div>
                  {i.url ? (
                    <a
                      href={i.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm shrink-0"
                    >
                      Serve ↗
                    </a>
                  ) : (
                    <span className="shrink-0 self-center font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                      Email
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
