"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { WidgetCard, WidgetEmpty } from "@/components/widgets/widget-shell";

export interface PartnerSpotlightItem {
  id: string;
  name: string;
  blurb: string;
  url: string;
  logoUrl: string | null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const ROTATE_MS = 8000;

/**
 * Partner Spotlight — a quiet, native acknowledgement card. Shows ONE partner
 * at a time and cross-fades to the next every 8s. Pauses on hover/focus and
 * respects prefers-reduced-motion (no auto-advance). Always labeled "Partner",
 * never a popup, never covers content.
 */
export function PartnersCard({
  items,
  number = "11",
}: {
  items: PartnerSpotlightItem[];
  number?: string;
}) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (items.length <= 1 || paused || reducedRef.current) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % items.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [items.length, paused]);

  // Keep index in range if the list shrinks between renders.
  useEffect(() => {
    if (idx >= items.length) setIdx(0);
  }, [items.length, idx]);

  if (items.length === 0) {
    return (
      <WidgetCard number={number} eyebrow="Partner" title="Partner Spotlight">
        <WidgetEmpty>Partner acknowledgements will appear here.</WidgetEmpty>
      </WidgetCard>
    );
  }

  const p = items[Math.min(idx, items.length - 1)];
  const host = hostOf(p.url);

  return (
    <WidgetCard number={number} eyebrow="Partner" title="Partner Spotlight">
      <div
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        className="flex h-full flex-col"
      >
        <a
          href={p.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          key={p.id}
          className="group animate-[fadeIn_0.4s_ease] flex flex-1 flex-col rounded-lg border border-border bg-surface/40 p-4 transition hover:border-accent"
        >
          <div className="flex items-center gap-3">
            {p.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.logoUrl}
                alt={p.name}
                className="h-12 w-12 shrink-0 rounded border border-border bg-transparent object-contain"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-border bg-surface font-display text-xl text-muted">
                {p.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold text-foreground group-hover:text-accent-bright">
                {p.name}
              </h3>
              {host ? (
                <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted">
                  {host}
                </p>
              ) : null}
            </div>
          </div>
          {p.blurb ? (
            <p className="mt-3 text-[13px] leading-relaxed text-muted">{p.blurb}</p>
          ) : null}
          <span className="mt-3 inline-block font-mono text-[10px] uppercase tracking-wider text-accent transition group-hover:text-accent-bright">
            Visit partner ↗
          </span>
        </a>

        <div className="mt-3 flex items-center justify-between">
          {items.length > 1 ? (
            <div className="flex items-center gap-1.5">
              {items.map((it, i) => (
                <button
                  key={it.id}
                  type="button"
                  aria-label={`Show ${it.name}`}
                  onClick={() => setIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === idx ? "w-4 bg-accent-bright" : "w-1.5 bg-border-strong"
                  }`}
                />
              ))}
            </div>
          ) : (
            <span />
          )}
          <Link
            href="/partners"
            className="font-mono text-[10px] uppercase tracking-wider text-muted transition hover:text-accent-bright"
          >
            All partners →
          </Link>
        </div>
      </div>
    </WidgetCard>
  );
}
