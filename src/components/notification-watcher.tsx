"use client";

import { useEffect, useRef, useState } from "react";

/**
 * In-app notification watcher (signed-in users only).
 *
 * Polls the server for the viewer's unread counts and, when the total *rises*,
 * plays a short chime and badges the browser tab (title prefix + a red favicon
 * badge) so an admin sitting on any page notices a new message or course
 * question without refreshing.
 *
 * Notes:
 * - Only fires the chime on an INCREASE, and never on the very first poll, so
 *   opening the app with existing unread items doesn't blast a sound.
 * - Audio is unlocked on the first user gesture (browsers block autoplay before
 *   interaction). Until then we still badge the tab silently.
 * - Skips polling while the tab is hidden; re-polls on becoming visible.
 * - Sound can be muted; the choice persists in localStorage.
 * - This is telemetry-grade: all failures are swallowed so it never disrupts
 *   the page.
 */

const POLL_INTERVAL_MS = 30_000;
const MUTE_KEY = "notif-muted";
const VOID = "#0d0f14";

interface Counts {
  messages: number;
  questions: number;
}

export function NotificationWatcher() {
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const prevTotal = useRef<number | null>(null);
  const baseTitle = useRef<string>("");
  const baseFavicon = useRef<string | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  // Load persisted mute preference.
  useEffect(() => {
    try {
      const m = localStorage.getItem(MUTE_KEY) === "1";
      setMuted(m);
      mutedRef.current = m;
    } catch {}
  }, []);

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      try {
        localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  // Unlock audio on the first user gesture.
  useEffect(() => {
    const unlock = () => {
      try {
        if (!audioRef.current) {
          const Ctx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          if (Ctx) audioRef.current = new Ctx();
        }
        audioRef.current?.resume?.();
      } catch {}
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Capture the pristine title + favicon once so we can restore them.
  useEffect(() => {
    baseTitle.current = document.title.replace(/^\(\d+\)\s*/, "");
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    baseFavicon.current = link?.getAttribute("href") ?? null;
  }, []);

  // Poll loop.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const applyBadge = (total: number) => {
      // Title prefix.
      const base = baseTitle.current || document.title.replace(/^\(\d+\)\s*/, "");
      document.title = total > 0 ? `(${total}) ${base}` : base;
      // Favicon badge.
      setFavicon(total, baseFavicon.current);
    };

    const chime = () => {
      if (mutedRef.current) return;
      const ctx = audioRef.current;
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        // Two short ascending notes.
        [880, 1175].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          const t = now + i * 0.16;
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.16);
        });
      } catch {}
    };

    const poll = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/notifications/poll", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Counts;
        const total = (data.messages || 0) + (data.questions || 0);
        applyBadge(total);
        if (prevTotal.current !== null && total > prevTotal.current) chime();
        prevTotal.current = total;
      } catch {}
    };

    void poll();
    timer = setInterval(poll, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", poll);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={toggleMute}
      aria-label={muted ? "Unmute alert sound" : "Mute alert sound"}
      title={muted ? "Alert sound off — click to enable" : "Alert sound on — click to mute"}
      className="fixed bottom-4 left-4 z-40 grid h-9 w-9 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)]/80 text-muted opacity-40 backdrop-blur transition hover:opacity-100 hover:text-foreground"
    >
      {muted ? <SpeakerOff /> : <SpeakerOn />}
    </button>
  );
}

/** Draw a small favicon with a red count badge; restore original when zero. */
function setFavicon(total: number, originalHref: string | null) {
  try {
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (total <= 0) {
      if (link && originalHref) link.setAttribute("href", originalHref);
      return;
    }
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Dark rounded background.
    ctx.fillStyle = VOID;
    roundRect(ctx, 0, 0, size, size, 14);
    ctx.fill();
    // Red badge circle.
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
    // Count text.
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${total > 9 ? 30 : 38}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(total > 9 ? "9+" : String(total), size / 2, size / 2 + 2);

    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.setAttribute("href", canvas.toDataURL("image/png"));
  } catch {}
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function SpeakerOn() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function SpeakerOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  );
}
