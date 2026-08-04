import { detectLinkEmbed } from "@/lib/link-embed";

/**
 * Renders a rich embed for the first link found in a post body. Videos become
 * responsive iframes; other links (Instagram, LinkedIn, X, …) become a safe
 * clickable "rich link" card. Renders nothing when there is no link.
 */
export function PostEmbed({ body }: { body: string }) {
  const e = detectLinkEmbed(body);
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

  return (
    <a
      href={e.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="mt-3 flex items-center gap-3 border border-border p-3 transition hover:border-accent-bright hover:bg-[rgba(0,180,216,0.04)]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center border border-border-strong font-display text-[11px] font-bold uppercase text-accent-bright">
        {e.platform.slice(0, 2)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[11px] font-bold uppercase tracking-[0.14em] text-accent-bright">
          {e.platform}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[12px] text-muted">
          {e.url}
        </span>
      </span>
      <span className="shrink-0 text-muted">↗</span>
    </a>
  );
}
