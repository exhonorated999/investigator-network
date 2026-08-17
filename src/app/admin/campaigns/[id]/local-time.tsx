"use client";

import { useEffect, useState } from "react";

/**
 * Render an instant in the VIEWER's local timezone. The server renders in UTC
 * (Railway), which made scheduled/sent times look wrong (e.g. "12:00 PM UTC").
 * We hydrate the value on the client so admins always see their own timezone.
 *
 * `iso` is an ISO-8601 UTC string (e.g. campaign.scheduledAt.toISOString()).
 */
export function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState("");

  useEffect(() => {
    const d = new Date(iso);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const pretty = d.toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
    setText(`${pretty} (${tz})`);
  }, [iso]);

  // Before hydration, fall back to a stable ISO so SSR/CSR markup matches.
  return <span suppressHydrationWarning>{text || iso}</span>;
}
