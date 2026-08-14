"use client";

import { useState } from "react";
import { WidgetCard, WidgetEmpty } from "@/components/widgets/widget-shell";
import { AddToCalendar } from "@/components/add-to-calendar";

export interface ConferenceItem {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string;
  url: string;
  about: string;
}

/** Compact date line shown on the collapsed row. */
function fmtRange(startsAt: Date, endsAt: Date | null): string {
  const d = startsAt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const t = startsAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (endsAt) {
    const e = endsAt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (e !== d) return `${d} – ${e}`;
  }
  return `${d} · ${t}`;
}

/** Fuller date + time detail shown in the expanded panel. */
function fmtFull(startsAt: Date, endsAt: Date | null): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  };
  const start = startsAt.toLocaleDateString(undefined, opts);
  const startTime = startsAt.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (endsAt) {
    const end = endsAt.toLocaleDateString(undefined, opts);
    if (end !== start) return `${start} — ${end}`;
  }
  return `${start} · ${startTime}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * One accordion row. Clicking the row expands it to reveal the full details
 * (description, exact date/time, location, and a link to the event site),
 * collapsing any other open row — the same interaction as the News feed.
 */
function ConferenceRow({
  c,
  open,
  onToggle,
}: {
  c: ConferenceItem;
  open: boolean;
  onToggle: (id: string) => void;
}) {
  const hasDetails = Boolean(c.about || c.url || c.location);

  return (
    <div className="border-b border-border py-2.5 last:border-b-0">
      {/* Header row: toggle button + calendar action (siblings — no nested
          interactive elements). */}
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onToggle(c.id)}
          aria-expanded={open}
          className="group min-w-0 flex-1 text-left"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-[15px] text-foreground group-hover:text-accent-bright">
                {c.name}
              </span>
              <span className="block font-mono text-[10px] uppercase tracking-wider text-muted">
                {fmtRange(c.startsAt, c.endsAt)}
                {c.location ? ` · ${c.location}` : ""}
              </span>
            </span>
            <span
              className={`shrink-0 text-muted transition-transform duration-300 group-hover:text-accent-bright ${
                open ? "rotate-90" : ""
              }`}
              aria-hidden="true"
            >
              ▸
            </span>
          </div>
        </button>

        <AddToCalendar
          title={c.name}
          start={c.startsAt.toISOString()}
          end={c.endsAt ? c.endsAt.toISOString() : null}
          location={c.location || "See event details"}
          details={c.about || "Conference / training listed on Investigator Network."}
          url={c.url}
          className="mt-0.5 shrink-0 border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted transition hover:border-accent hover:text-accent-bright"
          label="Calendar"
        />
      </div>

      {/* Expand reveal — full details, only while open. */}
      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent-bright/80">
            {fmtFull(c.startsAt, c.endsAt)}
          </p>
          {c.location ? (
            <p className="mt-1 text-[13px] text-muted">{c.location}</p>
          ) : null}
          {c.about ? (
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{c.about}</p>
          ) : null}
          {c.url ? (
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block font-mono text-[10px] uppercase tracking-wider text-accent transition hover:text-accent-bright"
            >
              Visit event site ↗ {hostOf(c.url) ? `· ${hostOf(c.url)}` : ""}
            </a>
          ) : null}
          {!hasDetails ? (
            <p className="text-[13px] text-muted">No additional details.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Upcoming conferences & trainings — click a row to expand its details. */
export function ConferencesCard({
  items,
  number = "10",
}: {
  items: ConferenceItem[];
  number?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  return (
    <WidgetCard number={number} eyebrow="Events" title="Conferences" count={items.length}>
      {items.length === 0 ? (
        <WidgetEmpty>No upcoming events. Check back soon.</WidgetEmpty>
      ) : (
        <div>
          {items.map((c) => (
            <ConferenceRow
              key={c.id}
              c={c}
              open={c.id === openId}
              onToggle={toggle}
            />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
