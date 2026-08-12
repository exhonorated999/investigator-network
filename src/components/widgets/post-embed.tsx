"use client";

import { useEffect, useRef, useState } from "react";
import { detectLinkEmbed, shortUrlLabel } from "@/lib/link-embed";

declare global {
  interface Window {
    twttr?: { widgets?: { load?: (el?: HTMLElement) => void } };
  }
}

/**
 * Loads X's widget script once and resolves when `window.twttr.widgets` is
 * ready. Multiple embeds share the single in-flight promise.
 */
let twttrReady: Promise<void> | null = null;
function loadTwitterWidgets(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.twttr?.widgets) return Promise.resolve();
  if (twttrReady) return twttrReady;

  twttrReady = new Promise<void>((resolve) => {
    const existing = document.getElementById("twitter-wjs") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      if (window.twttr?.widgets) resolve();
      return;
    }
    const s = document.createElement("script");
    s.id = "twitter-wjs";
    s.src = "https://platform.twitter.com/widgets.js";
    s.async = true;
    s.charset = "utf-8";
    s.addEventListener("load", () => resolve());
    document.body.appendChild(s);
  });
  return twttrReady;
}

/**
 * Renders a rich embed for the first link found in a post body.
 *
 * Videos become responsive iframes. Everything else becomes a link card that
 * upgrades itself: it renders immediately from the URL alone, then fetches
 * OpenGraph metadata from /api/link-preview and fills in the headline, summary,
 * and thumbnail once available.
 *
 * The two-stage approach matters because sites like LinkedIn and Instagram
 * frequently refuse to serve metadata to servers. When that happens the card
 * simply stays in its first state instead of collapsing to nothing.
 */

interface Preview {
  url: string;
  host: string;
  title: string;
  summary: string;
  imageUrl: string;
  sourceName: string;
}

export function PostEmbed({ body }: { body: string }) {
  const e = detectLinkEmbed(body);
  const url = e && e.kind === "link" ? e.url : null;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [imageOk, setImageOk] = useState(true);

  useEffect(() => {
    if (!url) return;
    let live = true;
    setPreview(null);
    setImageOk(true);

    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d?.ok && d.preview) setPreview(d.preview as Preview);
      })
      .catch(() => {
        /* keep the plain card */
      });

    return () => {
      live = false;
    };
  }, [url]);

  if (!e) return null;

  if (e.kind === "twitter") {
    return <TweetEmbed url={e.url} />;
  }

  if ((e.kind === "youtube" || e.kind === "vimeo") && e.embedUrl) {
    return (
      <div className="mt-3 overflow-hidden border border-border">
        <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
          <iframe
            src={e.embedUrl}
            title={`${e.platform} video`}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    );
  }

  if (e.kind === "instagram" && e.embedUrl) {
    return (
      <div className="mt-3 flex justify-center overflow-hidden border border-border bg-white">
        <iframe
          src={e.embedUrl}
          title="Instagram post"
          loading="lazy"
          scrolling="no"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          className="w-full max-w-[420px] border-0"
          style={{ height: 660 }}
        />
      </div>
    );
  }

  if (e.kind === "linkedin" && e.embedUrl) {
    return (
      <div className="mt-3 flex justify-center overflow-hidden border border-border bg-white">
        <iframe
          src={e.embedUrl}
          title="LinkedIn post"
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          className="w-full max-w-[550px] border-0"
          style={{ height: 600 }}
        />
      </div>
    );
  }

  const showImage = Boolean(preview?.imageUrl) && imageOk;
  const source = preview?.sourceName?.trim() || e.platform;

  return (
    <a
      href={e.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="group mt-3 block overflow-hidden border border-border transition hover:border-accent-bright hover:bg-[rgba(0,180,216,0.04)]"
    >
      {showImage ? (
        <div className="relative aspect-[1.91/1] w-full overflow-hidden border-b border-border bg-well-strong">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview!.imageUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageOk(false)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        </div>
      ) : null}

      <div className="flex items-start gap-3 p-3">
        {showImage ? null : (
          <span className="grid h-9 w-9 shrink-0 place-items-center border border-border-strong font-display text-[11px] font-bold uppercase text-accent-bright">
            {e.platform.slice(0, 2)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-accent-bright">
              {source}
            </span>
            <span className="font-mono text-[10px] text-muted/70">
              {e.host}
            </span>
          </span>

          {preview?.title ? (
            <span className="mt-1 block text-[15px] font-semibold leading-snug text-foreground">
              {preview.title}
            </span>
          ) : null}

          {preview?.summary ? (
            <span className="mt-1 block line-clamp-2 text-[13px] leading-relaxed text-muted">
              {preview.summary}
            </span>
          ) : null}

          {preview?.title ? null : (
            <span className="mt-0.5 block truncate font-mono text-[12px] text-muted">
              {shortUrlLabel(e.url)}
            </span>
          )}
        </span>
        <span className="shrink-0 text-muted transition group-hover:text-accent-bright">
          ↗
        </span>
      </div>
    </a>
  );
}

/**
 * Renders an X (Twitter) post using the official widget script. The blockquote
 * is the documented no-JS fallback; once widgets.js loads it is replaced in
 * place with the rendered, video-playable embed in the dark theme.
 */
function TweetEmbed({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    loadTwitterWidgets().then(() => {
      if (live && ref.current) window.twttr?.widgets?.load?.(ref.current);
    });
    return () => {
      live = false;
    };
  }, [url]);

  return (
    <div ref={ref} className="mt-3 overflow-hidden [&_.twitter-tweet]:!mx-auto">
      <blockquote
        className="twitter-tweet"
        data-theme="dark"
        data-dnt="true"
        data-conversation="none"
      >
        <a href={url}>{url}</a>
      </blockquote>
    </div>
  );
}
