import { WidgetCard, WidgetEmpty } from "@/components/widgets/widget-shell";
import { GRANT_CATEGORY_LABEL, type GrantItem } from "@/lib/grants";

/** Format a due date + how urgent it is. */
function dueMeta(iso: string | null): { label: string; urgent: boolean } {
  if (!iso) return { label: "Rolling / no deadline", urgent: false };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()))
    return { label: "Rolling / no deadline", urgent: false };
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  const label = d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  if (days < 0) return { label: `Closed ${label}`, urgent: false };
  if (days <= 30) return { label: `Due ${label} · ${days}d left`, urgent: true };
  return { label: `Due ${label}`, urgent: false };
}

/**
 * LE-only funding card. Lists published grants soonest-deadline first, with the
 * agency, who qualifies, relevance chips, and a button straight to the grant
 * page. Rendered only for Law-Enforcement members (gated in the dashboard).
 */
export function GrantsCard({
  items,
  number = "14",
}: {
  items: GrantItem[];
  number?: string;
}) {
  return (
    <WidgetCard
      number={number}
      eyebrow="Funding"
      title="LE Grants"
      count={items.length}
      tone="gold"
    >
      {items.length === 0 ? (
        <WidgetEmpty>No grants posted yet — check back soon.</WidgetEmpty>
      ) : (
        <div className="space-y-4">
          {items.map((g) => {
            const due = dueMeta(g.dueDate);
            return (
              <div
                key={g.id}
                className="border-b border-border pb-4 last:border-b-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] leading-snug text-foreground">
                      {g.title}
                    </p>
                    <p
                      className={`mt-1 font-mono text-[11px] ${
                        due.urgent ? "text-danger" : "text-muted"
                      }`}
                    >
                      {due.label}
                    </p>
                  </div>
                  <a
                    href={g.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm shrink-0"
                  >
                    View grant ↗
                  </a>
                </div>

                {g.summary ? (
                  <p className="mt-2 text-[13px] leading-snug text-muted line-clamp-3">
                    {g.summary}
                  </p>
                ) : null}

                <dl className="mt-2 grid gap-x-3 gap-y-0.5 text-[12px] sm:grid-cols-[auto_1fr]">
                  {g.grantingAgency ? (
                    <>
                      <dt className="font-mono uppercase tracking-wide text-muted/70">
                        Agency
                      </dt>
                      <dd className="text-muted">{g.grantingAgency}</dd>
                    </>
                  ) : null}
                  {g.qualifyingAgency ? (
                    <>
                      <dt className="font-mono uppercase tracking-wide text-muted/70">
                        Eligible
                      </dt>
                      <dd className="text-muted">{g.qualifyingAgency}</dd>
                    </>
                  ) : null}
                </dl>

                {g.categories.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {g.categories.map((c) => (
                      <span key={c} className="tag-chip tag-chip-cyan">
                        {GRANT_CATEGORY_LABEL[c]}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
