import { WidgetCard, WidgetEmpty } from "@/components/widgets/widget-shell";

export interface ConferenceItem {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string;
  url: string;
}

function fmtRange(startsAt: Date, endsAt: Date | null): string {
  const d = startsAt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const t = startsAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (endsAt) {
    const e = endsAt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (e !== d) return `${d} – ${e}`;
  }
  return `${d} · ${t}`;
}

/** Upcoming conferences & trainings — mirrors the Tools & resources card. */
export function ConferencesCard({
  items,
  number = "10",
}: {
  items: ConferenceItem[];
  number?: string;
}) {
  return (
    <WidgetCard number={number} eyebrow="Events" title="Conferences" count={items.length}>
      {items.length === 0 ? (
        <WidgetEmpty>No upcoming events. Check back soon.</WidgetEmpty>
      ) : (
        <div>
          {items.map((c) => {
            const inner = (
              <>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] text-foreground group-hover:text-accent-bright">
                    {c.name}
                  </span>
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-muted">
                    {fmtRange(c.startsAt, c.endsAt)}
                    {c.location ? ` · ${c.location}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-muted">{c.url ? "↗" : "→"}</span>
              </>
            );
            return c.url ? (
              <a
                key={c.id}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0 transition hover:bg-[rgba(0,180,216,0.05)]"
              >
                {inner}
              </a>
            ) : (
              <div
                key={c.id}
                className="group flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0"
              >
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
