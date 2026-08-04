import { WidgetCard, WidgetEmpty } from "@/components/widgets/widget-shell";
import { AddToCalendar } from "@/components/add-to-calendar";

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
            // The calendar button can't live inside the row's <a> (nested
            // interactive elements), so the link and the button are siblings.
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
            return (
              <div
                key={c.id}
                className="flex items-center gap-2 border-b border-border py-2.5 last:border-b-0"
              >
                {c.url ? (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex min-w-0 flex-1 items-center justify-between gap-3 transition hover:bg-[rgba(0,180,216,0.05)]"
                  >
                    {inner}
                  </a>
                ) : (
                  <div className="group flex min-w-0 flex-1 items-center justify-between gap-3">
                    {inner}
                  </div>
                )}
                <AddToCalendar
                  title={c.name}
                  start={c.startsAt.toISOString()}
                  end={c.endsAt ? c.endsAt.toISOString() : null}
                  location={c.location || "See event details"}
                  details="Conference / training listed on Investigator Network."
                  url={c.url}
                  className="shrink-0 border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted transition hover:border-accent hover:text-accent-bright"
                  label="Calendar"
                />
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
