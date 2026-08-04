"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Add to calendar" button with a provider menu.
 *
 * Teams deliberately has no entry of its own: a Teams user's calendar *is* their
 * Outlook calendar, so "Outlook (Microsoft 365)" is what a work account needs and
 * the event shows up in Teams automatically. The .ics download covers Outlook
 * desktop, Apple Calendar and anything else, and is served by /api/calendar so
 * mobile OSes get a real text/calendar response to hand off.
 */
export function AddToCalendar({
  title,
  start,
  end,
  location = "Microsoft Teams",
  details = "",
  url = "",
  allDay = false,
  className = "btn btn-ghost",
  label = "+ Add to calendar",
}: {
  title: string;
  /** ISO string or ms epoch. */
  start: string | number;
  end?: string | number | null;
  location?: string;
  details?: string;
  url?: string;
  allDay?: boolean;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape — a menu you can't dismiss is a trap.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const startAt = new Date(start);
  if (Number.isNaN(startAt.getTime())) return null;
  const endAt =
    end != null && !Number.isNaN(new Date(end).getTime())
      ? new Date(end)
      : new Date(startAt.getTime() + 60 * 60_000);

  const body = [details, url ? `Join: ${url}` : ""].filter(Boolean).join("\n\n");

  // Google wants compact UTC (or bare dates for all-day).
  const gStamp = (d: Date) =>
    allDay
      ? d.toISOString().slice(0, 10).replace(/-/g, "")
      : d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const google =
    "https://calendar.google.com/calendar/render?" +
    new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: `${gStamp(startAt)}/${gStamp(endAt)}`,
      details: body,
      location,
    }).toString();

  // Outlook web deep links take ISO 8601; both hosts share the same shape.
  const outlookParams = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: title,
    startdt: allDay ? startAt.toISOString().slice(0, 10) : startAt.toISOString(),
    enddt: allDay ? endAt.toISOString().slice(0, 10) : endAt.toISOString(),
    body,
    location,
    ...(allDay ? { allday: "true" } : {}),
  }).toString();

  const office = `https://outlook.office.com/calendar/0/deeplink/compose?${outlookParams}`;
  const live = `https://outlook.live.com/calendar/0/deeplink/compose?${outlookParams}`;

  const ics =
    "/api/calendar?" +
    new URLSearchParams({
      title,
      start: startAt.toISOString(),
      end: endAt.toISOString(),
      location,
      details,
      url,
      ...(allDay ? { allday: "1" } : {}),
    }).toString();

  const items: { label: string; href: string; hint: string; download?: boolean }[] =
    [
      {
        label: "Outlook / Teams",
        href: office,
        hint: "Microsoft 365 work account",
      },
      { label: "Outlook.com", href: live, hint: "Personal Microsoft account" },
      { label: "Google Calendar", href: google, hint: "" },
      {
        label: "Download .ics",
        href: ics,
        hint: "Outlook desktop, Apple Calendar",
        download: true,
      },
    ];

  return (
    <div ref={wrap} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={className}
      >
        {label}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-50 mt-2 w-60 border border-border-strong bg-surface p-1 shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
        >
          {items.map((it) => (
            <a
              key={it.label}
              role="menuitem"
              href={it.href}
              {...(it.download
                ? { download: "" }
                : { target: "_blank", rel: "noopener noreferrer" })}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 transition hover:bg-[rgba(0,180,216,0.08)]"
            >
              <span className="block text-[13px] text-foreground">{it.label}</span>
              {it.hint ? (
                <span className="block font-mono text-[10px] text-muted">
                  {it.hint}
                </span>
              ) : null}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
