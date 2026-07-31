"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Ping interval. Intentionally duplicated from lib/presence.ts rather than
 * imported: that module pulls in Prisma, and importing it from a client
 * component would drag the database client into the browser bundle. Keep this
 * in sync with HEARTBEAT_INTERVAL_MS there.
 */
const HEARTBEAT_INTERVAL_MS = 45_000;

/**
 * Sends a presence heartbeat while the app is open.
 *
 * Design notes:
 * - Pings immediately on mount and on every route change, so "what course are
 *   they in" updates the moment they navigate rather than up to a full
 *   interval later.
 * - Skips pings while the tab is hidden. Browsers throttle background timers
 *   anyway, and a backgrounded tab isn't really "active" — letting it lapse is
 *   what makes the idle/offline distinction meaningful. Pings again as soon as
 *   the tab becomes visible.
 * - Fire-and-forget with `keepalive`; failures are ignored on purpose. This is
 *   telemetry and must never disrupt the page.
 */
export function PresenceBeacon() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    let cancelled = false;

    const ping = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      void fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathRef.current }),
        keepalive: true,
      }).catch(() => {});
    };

    ping();
    const timer = setInterval(ping, HEARTBEAT_INTERVAL_MS);
    document.addEventListener("visibilitychange", ping);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
    // Re-runs on navigation so a route change pings right away.
  }, [pathname]);

  return null;
}
