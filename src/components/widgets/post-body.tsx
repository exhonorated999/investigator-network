"use client";

import { cleanUrl, shortUrlLabel } from "@/lib/link-embed";

/**
 * Post body text with links made presentable.
 *
 * Members paste share links straight from LinkedIn and X, which arrive as
 * 200-character strings of tracking parameters and wrapped across three lines.
 * URLs are replaced with a short `host/path` label pointing at the cleaned URL.
 *
 * When the body is nothing but a single link, it renders nothing at all — the
 * preview card below already represents it, so printing the URL twice is noise.
 */

const URL_SPLIT = /(https?:\/\/[^\s<>"')]+)/gi;

export function PostBody({
  body,
  className = "mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90",
  hideWhenBareLink = true,
}: {
  body: string;
  className?: string;
  /** Set false where no preview card follows (comments), so the link still shows. */
  hideWhenBareLink?: boolean;
}) {
  const text = String(body ?? "");
  const trimmed = text.trim();

  // Body is just a bare link — the embed card speaks for it.
  if (hideWhenBareLink && /^https?:\/\/\S+$/i.test(trimmed)) return null;

  const parts = text.split(URL_SPLIT);

  return (
    <p className={className}>
      {parts.map((part, i) => {
        if (!/^https?:\/\//i.test(part)) return part;
        const href = cleanUrl(part.replace(/[.,;:!?]+$/, ""));
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={(ev) => ev.stopPropagation()}
            className="break-all text-accent underline transition hover:text-accent-bright"
          >
            {shortUrlLabel(href)}
          </a>
        );
      })}
    </p>
  );
}
