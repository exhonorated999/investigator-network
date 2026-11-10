"use client";

import Image from "next/image";
import { useState } from "react";

type Shot = { key: string; tab: string; title: string; blurb: string; src: string };

const SHOTS: Shot[] = [
  {
    key: "dashboard",
    tab: "Dashboard",
    title: "Your whole caseload, the moment you log in",
    blurb:
      "New assignments, arrests, recoveries and overdue warrant returns surface on one screen — no spreadsheet required.",
    src: "/course-landing/viper/viper-dashboard.png",
  },
  {
    key: "board",
    tab: "Connection Board",
    title: "See how suspects, phones and places connect",
    blurb:
      "Drag people, devices, vehicles and locations onto a board and link them. The picture you used to draw on a whiteboard, saved with the case.",
    src: "/course-landing/viper/viper-connection-board.png",
  },
  {
    key: "warrant",
    tab: "Warrant Author",
    title: "Write it, serve it, track the return",
    blurb:
      "Draft warrants from templates, log service, and let VIPER chase the provider for you when a return runs late.",
    src: "/course-landing/viper/viper-warrant-author.png",
  },
  {
    key: "comms",
    tab: "Comms Intel",
    title: "Turn a phone extraction into leads",
    blurb:
      "Import DataPilot and Cellebrite extractions and get top contacts, activity patterns and anomalies flagged automatically.",
    src: "/course-landing/viper/viper-datapilot-insights.png",
  },
  {
    key: "timeline",
    tab: "Timeline",
    title: "A case timeline that builds itself",
    blurb:
      "Reports, evidence, warrants and notes fall into chronological order on their own — ready for your affidavit or the prosecutor.",
    src: "/course-landing/viper/viper-case-timeline.png",
  },
  {
    key: "whisper",
    tab: "Transcription",
    title: "Dictate reports and transcribe interviews offline",
    blurb:
      "Built-in Whisper speech-to-text runs on your own machine. Nothing is uploaded, ever.",
    src: "/course-landing/viper/viper-whisper-transcription.png",
  },
  {
    key: "uc",
    tab: "Undercover Chat",
    title: "Capture undercover conversations as evidence",
    blurb:
      "Log UC chats with timestamps and screenshots, organized by operation and attached to the case.",
    src: "/course-landing/viper/viper-undercover-chat.png",
  },
  {
    key: "icac",
    tab: "ICAC & CyberTips",
    title: "Purpose-built for ICAC units",
    blurb:
      "Open a CyberTip investigation in minutes, review BitTorrent single-source downloads, and keep your IDS statistics current.",
    src: "/course-landing/viper/viper-icac-integration.png",
  },
];

/** Tabbed screenshot viewer for the VIPER course landing page. */
export function ViperShowcase() {
  const [active, setActive] = useState(0);
  const shot = SHOTS[active];

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div
        role="tablist"
        aria-label="VIPER screens"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
      >
        {SHOTS.map((s, i) => {
          const on = i === active;
          return (
            <button
              key={s.key}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => setActive(i)}
              className={`group flex shrink-0 items-center gap-3 border px-4 py-3 text-left transition ${
                on
                  ? "border-[var(--viper)] bg-[var(--viper-soft)] text-foreground"
                  : "border-border bg-surface/60 text-muted hover:border-border-strong hover:text-foreground"
              }`}
            >
              <span
                className={`font-mono text-[10px] ${on ? "text-[var(--viper-ink)]" : "text-muted/70"}`}
              >
                {(i + 1).toString().padStart(2, "0")}
              </span>
              <span className="font-display text-[11px] font-semibold uppercase tracking-[0.14em]">
                {s.tab}
              </span>
            </button>
          );
        })}
      </div>

      <figure className="min-w-0">
        <a
          href={shot.src}
          target="_blank"
          rel="noopener noreferrer"
          className="viper-screen group block"
          title="Open full size"
        >
          <div className="viper-screen-bar">
            <span />
            <span />
            <span />
            <em>viper — {shot.tab.toLowerCase()}</em>
          </div>
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#0b1016]">
            <Image
              key={shot.key}
              src={shot.src}
              alt={shot.title}
              fill
              sizes="(min-width: 1024px) 860px, 100vw"
              className="viper-fade object-cover object-top transition duration-500 group-hover:scale-[1.015]"
            />
          </div>
        </a>
        <figcaption className="mt-4">
          <p className="display-sm text-foreground">{shot.title}</p>
          <p className="mt-2 max-w-2xl text-muted">{shot.blurb}</p>
        </figcaption>
      </figure>
    </div>
  );
}
