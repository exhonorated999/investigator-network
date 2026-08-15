import Link from "next/link";
import { WidgetCard, WidgetEmpty } from "@/components/widgets/widget-shell";

export interface PodcastListItem {
  id: string;
  title: string;
  category: string;
}

/**
 * Case-law Podcasts widget — a compact list of the most recent AI-generated
 * ruling explainers. Playback happens on the /podcasts library page; the
 * widget just teases the latest episodes. Always carries the informational-only
 * note so the disclaimer travels with the placement.
 */
export function PodcastsCard({
  items,
  number = "12",
}: {
  items: PodcastListItem[];
  number?: string;
}) {
  if (items.length === 0) {
    return (
      <WidgetCard number={number} eyebrow="Case law" title="Case-law Podcasts">
        <WidgetEmpty>New ruling explainers will appear here.</WidgetEmpty>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard number={number} eyebrow="Case law" title="Case-law Podcasts">
      <div className="flex h-full flex-col">
        <ul className="flex-1 divide-y divide-border">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                href="/podcasts"
                className="group flex items-start gap-3 py-2.5 transition"
              >
                <span
                  aria-hidden
                  className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-surface text-accent-bright transition group-hover:border-accent-bright"
                >
                  ▶
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] leading-snug text-foreground group-hover:text-accent-bright">
                    {p.title}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-muted">
                    {p.category}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted">
            Informational only · not legal advice
          </span>
          <Link
            href="/podcasts"
            className="font-mono text-[10px] uppercase tracking-wider text-muted transition hover:text-accent-bright"
          >
            All episodes →
          </Link>
        </div>
      </div>
    </WidgetCard>
  );
}
