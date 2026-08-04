"use client";

import { useEffect, useState } from "react";
import { detectLinkEmbed, shortUrlLabel } from "@/lib/link-embed";

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
