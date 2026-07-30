"use client";

import { useEffect, useState } from "react";

/**
 * Live instructor-led session panel. Teams meetings can't be iframe-embedded
 * (Microsoft blocks framing), so "Join" opens Teams in a right-sized pop-up
 * window that feels connected to the app. Adds a live countdown / status and
 * an add-to-calendar (.ics) download.
 */
export function LiveSession({
  title,
  teamsJoinUrl,
  startsAt,
  durationMin,
  replayUrl,
}: {
  title: string;
  teamsJoinUrl: string;
  startsAt: string;
  durationMin: number | null;
  replayUrl: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  // Tick every second, client-only, to avoid a hydration mismatch on time.
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const start = startsAt ? new Date(startsAt).getTime() : null;
  const dur = durationMin ?? 60;
  const end = start != null ? start + dur * 60_000 : null;

  type Phase = "pending" | "upcoming" | "soon" | "live" | "ended";
  let phase: Phase = "pending";
  if (now != null && start != null && end != null) {
    if (now < start) phase = start - now <= 15 * 60_000 ? "soon" : "upcoming";
    else if (now <= end) phase = "live";
    else phase = "ended";
  }

  const canJoin = !!teamsJoinUrl && (phase === "soon" || phase === "live");

  function joinPopup() {
    if (!teamsJoinUrl) return;
    const w = 1100;
    const h = 760;
    const left = Math.max(0, Math.round((window.screen.availWidth - w) / 2));
    const top = Math.max(0, Math.round((window.screen.availHeight - h) / 2));
    const win = window.open(
      teamsJoinUrl,
      "teams_meeting",
      `popup=yes,width=${w},height=${h},left=${left},top=${top},noopener`
    );
    // Popup blocked → fall back to a normal new tab.
    if (!win) window.open(teamsJoinUrl, "_blank", "noopener,noreferrer");
  }

  function addToCalendar() {
    if (start == null || end == null) return;
    const esc = (s: string) =>
      s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
    const stamp = (ms: number) =>
      new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Investigator Network//Live Session//EN",
      "BEGIN:VEVENT",
      `UID:${start}-${Math.random().toString(36).slice(2)}@investigator-network`,
      `DTSTAMP:${stamp(Date.now())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(title)}`,
      `DESCRIPTION:${esc(`Live instructor-led session.${teamsJoinUrl ? ` Join: ${teamsJoinUrl}` : ""}`)}`,
      teamsJoinUrl ? `URL:${esc(teamsJoinUrl)}` : "",
      "LOCATION:Microsoft Teams",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\w]+/g, "-").slice(0, 40) || "session"}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <div className="panel rule-top p-6">
      <div className="flex items-center gap-2">
        <span className="tag-chip tag-chip-cyan">// DISPATCH</span>
        <span className="eyebrow eyebrow-muted">
          Live session · Microsoft Teams
        </span>
        <StatusBadge phase={phase} />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="border border-border bg-[rgba(10,12,17,0.6)] p-4">
          <p className="eyebrow eyebrow-muted text-[10px]">Date / Time</p>
          <p className="mt-2 font-mono text-sm text-foreground">
            {startsAt ? fmtDateTime(startsAt) : "TBA"}
          </p>
        </div>
        <div className="border border-border bg-[rgba(10,12,17,0.6)] p-4">
          <p className="eyebrow eyebrow-muted text-[10px]">
            {phase === "live"
              ? "Ends in"
              : phase === "ended"
                ? "Duration"
                : "Starts in"}
          </p>
          <p className="mt-2 font-mono text-sm text-foreground">
            <Countdown phase={phase} now={now} start={start} end={end} dur={dur} />
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {teamsJoinUrl ? (
          <button
            type="button"
            onClick={joinPopup}
            className={`btn ${canJoin ? "btn-primary" : "btn-ghost"}`}
          >
            {phase === "live" ? "◉ Join live session" : "Join Teams meeting"}
          </button>
        ) : (
          <span className="text-sm text-muted">Join link not yet posted.</span>
        )}

        {start != null && phase !== "ended" ? (
          <button type="button" onClick={addToCalendar} className="btn btn-ghost">
            + Add to calendar
          </button>
        ) : null}

        {replayUrl ? (
          <a
            href={replayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
          >
            Watch replay
          </a>
        ) : null}
      </div>

      {teamsJoinUrl && !canJoin && phase !== "ended" ? (
        <p className="mt-3 font-mono text-[11px] text-muted">
          The join button activates 15 minutes before start. It opens Teams in a
          floating window so you can keep the course open beside it.
        </p>
      ) : null}
    </div>
  );
}

function StatusBadge({ phase }: { phase: string }) {
  if (phase === "live") {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-danger/50 bg-[rgba(239,68,68,0.12)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--danger)]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--danger)]" />
        Live now
      </span>
    );
  }
  if (phase === "soon") {
    return (
      <span className="rounded-full border border-gold/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
        Starting soon
      </span>
    );
  }
  if (phase === "ended") {
    return (
      <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        Ended
      </span>
    );
  }
  return null;
}

function Countdown({
  phase,
  now,
  start,
  end,
  dur,
}: {
  phase: string;
  now: number | null;
  start: number | null;
  end: number | null;
  dur: number;
}) {
  if (now == null || start == null || end == null) {
    return <>—</>;
  }
  if (phase === "ended") return <>{dur} min</>;
  const target = phase === "live" ? end : start;
  const ms = Math.max(0, target - now);
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h || d) parts.push(`${h}h`);
  if (!d) parts.push(`${m}m`);
  if (!d && !h) parts.push(`${sec}s`);
  return <>{parts.join(" ")}</>;
}
