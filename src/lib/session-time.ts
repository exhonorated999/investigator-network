/**
 * Session time parsing (server-only utility, no DB imports).
 *
 * Live-session `startsAt` values are stored in a mix of formats:
 *   - ISO with timezone:  "2026-08-31T15:30:00.000Z"      (advanced sessions)
 *   - Naive wall-clock:   "2026-08-07T09:00"               (essentials sessions)
 *
 * A naive value has no offset, so the platform intends it as Pacific
 * (America/Los_Angeles) wall-clock — that's the audience's timezone. If we let
 * `new Date()` parse it, it would be interpreted in the *server's* zone (UTC on
 * Railway), shifting it by 7-8 hours. These helpers resolve a naive value to the
 * correct UTC instant by anchoring it to Pacific, DST-aware.
 */

const PACIFIC = "America/Los_Angeles";

/** True when the string carries an explicit offset ("Z" or ±HH:MM). */
function hasTimezone(raw: string): boolean {
  return /[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw.trim());
}

/**
 * Offset (in ms) of `tz` relative to UTC at the given instant. Negative for
 * zones behind UTC (Pacific is -7h PDT / -8h PST).
 */
function tzOffsetMs(tz: string, at: Date): number {
  const utc = new Date(at.toLocaleString("en-US", { timeZone: "UTC" }));
  const local = new Date(at.toLocaleString("en-US", { timeZone: tz }));
  return local.getTime() - utc.getTime();
}

/**
 * Resolve a stored `startsAt` string to a real UTC instant (Date).
 * Returns null if unparseable.
 */
export function parseSessionInstant(raw: unknown): Date | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const s = raw.trim();

  if (hasTimezone(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Naive "YYYY-MM-DDTHH:mm[:ss]" — interpret the numerals as Pacific wall-clock.
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [, y, mo, da, hh, mm, ss] = m;
  // First, treat the wall-clock numerals as if they were UTC.
  const asUtc = Date.UTC(+y, +mo - 1, +da, +hh, +mm, ss ? +ss : 0);
  // Then subtract Pacific's offset at that moment to get the true UTC instant.
  let offset = tzOffsetMs(PACIFIC, new Date(asUtc));
  let instant = asUtc - offset;
  // One correction pass in case the offset differs across a DST boundary.
  const offset2 = tzOffsetMs(PACIFIC, new Date(instant));
  if (offset2 !== offset) {
    offset = offset2;
    instant = asUtc - offset;
  }
  return new Date(instant);
}

/**
 * The UTC instant corresponding to a given Pacific wall-clock time
 * (hour:minute) on the same calendar day as `dayInPacific`.
 * Used to compute "the day before the session, at 9am Pacific".
 */
export function pacificTimeOnDay(dayInPacific: Date, hour: number, minute = 0): Date {
  // Get the Pacific calendar date for the reference instant.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dayInPacific);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = +get("year");
  const mo = +get("month");
  const da = +get("day");

  const asUtc = Date.UTC(y, mo - 1, da, hour, minute, 0);
  let offset = tzOffsetMs(PACIFIC, new Date(asUtc));
  let instant = asUtc - offset;
  const offset2 = tzOffsetMs(PACIFIC, new Date(instant));
  if (offset2 !== offset) {
    offset = offset2;
    instant = asUtc - offset;
  }
  return new Date(instant);
}

/** Pacific calendar-day key ("YYYY-MM-DD") for grouping same-day sessions. */
export function pacificDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: PACIFIC,
  }).format(d);
}

/** Pacific weekday index (0=Sun .. 6=Sat) for an instant. */
export function pacificWeekday(d: Date): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: PACIFIC,
  }).format(d);
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[wd] ?? 0;
}

/**
 * 9am Pacific on the most recent Friday strictly BEFORE the session's Pacific
 * day. Used for the Advanced Datapilot course, whose sessions run on Mondays
 * and whose prep reminder must go out the Friday before (never the weekend).
 * If a session ever falls on a Friday, this returns the prior Friday.
 */
export function previousFridayGate(sessionInstant: Date): Date {
  const wd = pacificWeekday(sessionInstant); // Fri = 5
  let daysBack = (wd - 5 + 7) % 7; // days since the most recent Friday
  if (daysBack === 0) daysBack = 7; // session on a Friday -> previous Friday
  const fridayRef = new Date(sessionInstant.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return pacificTimeOnDay(fridayRef, 9, 0);
}

/** Format just the calendar date in Pacific, e.g. "Monday, August 31, 2026". */
export function formatPacificDate(d: Date): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: PACIFIC,
    }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

/** Format just the clock time in Pacific, e.g. "8:30 AM Pacific". */
export function formatPacificTimeOnly(d: Date): string {
  try {
    return (
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: PACIFIC,
      }).format(d) + " Pacific"
    );
  } catch {
    return d.toLocaleTimeString();
  }
}

/** Format an instant for display in Pacific time. */
export function formatPacific(d: Date): string {
  try {
    return (
      new Intl.DateTimeFormat("en-US", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: PACIFIC,
      }).format(d) + " (Pacific)"
    );
  } catch {
    return d.toLocaleString();
  }
}
