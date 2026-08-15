import { requireViewer } from "@/lib/viewer";
import { SiteHeader } from "@/components/site-header";
import {
  loadPodcastsForViewer,
  PODCAST_CATEGORIES,
  PODCAST_DISCLAIMER,
  type PodcastView,
} from "@/lib/podcasts";

export const dynamic = "force-dynamic";

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function EpisodeCard({ p }: { p: PodcastView }) {
  return (
    <article className="panel flex flex-col p-5">
      <div className="flex items-center gap-2">
        <span className="border border-gold/40 bg-[rgba(212,175,55,0.08)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
          {p.category}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          {fmtDate(p.publishedAt)}
        </span>
      </div>
      <h3 className="mt-3 text-[18px] font-semibold leading-snug text-foreground">
        {p.title}
      </h3>
      {p.description ? (
        <p className="mt-2 text-[14px] leading-relaxed text-muted">{p.description}</p>
      ) : null}

      <div className="mt-4">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio
          controls
          preload="none"
          src={p.audioUrl}
          className="w-full"
        />
      </div>

      {p.rulingUrl ? (
        <a
          href={p.rulingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-accent-bright hover:underline"
        >
          Read the ruling ↗
        </a>
      ) : null}
    </article>
  );
}

export default async function PodcastLibraryPage() {
  const viewer = await requireViewer();
  const episodes = await loadPodcastsForViewer(viewer);

  // Group into the defined category order; drop empty groups. Any unexpected
  // category (hand-edited data) falls into an "Other" bucket at the end.
  const known = new Set<string>(PODCAST_CATEGORIES);
  const groups: { label: string; items: PodcastView[] }[] = PODCAST_CATEGORIES.map(
    (c) => ({ label: c, items: episodes.filter((e) => e.category === c) })
  ).filter((g) => g.items.length > 0);
  const other = episodes.filter((e) => !known.has(e.category));
  if (other.length > 0) groups.push({ label: "Other", items: other });

  return (
    <div className="min-h-screen">
      <SiteHeader name={viewer.name} isAdmin={viewer.role === "ADMIN"} />

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-8">
        <section className="reveal reveal-1">
          <span className="pill">Case law</span>
          <h1 className="display-lg mt-4">
            Case-law <span className="glow-text">podcasts</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[17px] text-muted">
            Short, AI-generated audio explainers that turn dense court rulings
            into plain-language takeaways for the field — so you can grasp how a
            decision affects your investigations without reading pages of legal
            opinion.
          </p>
        </section>

        {/* Disclaimer */}
        <div className="reveal reveal-2 panel rule-top mt-6 border-gold/30 bg-[rgba(212,175,55,0.05)] p-4">
          <p className="eyebrow eyebrow-gold">Disclaimer</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            {PODCAST_DISCLAIMER}
          </p>
        </div>

        {episodes.length === 0 ? (
          <p className="panel mt-10 px-6 py-12 text-center text-muted">
            No episodes published yet. Check back soon.
          </p>
        ) : (
          <div className="mt-10 grid gap-12">
            {groups.map((g, gi) => (
              <section key={g.label} className={`reveal reveal-${Math.min(gi + 3, 5)}`}>
                <div className="flex items-center gap-3 border-b border-border pb-3">
                  <p className="eyebrow eyebrow-gold">{g.label}</p>
                  <span className="font-mono text-[11px] text-muted">
                    {String(g.items.length).padStart(2, "0")}
                  </span>
                </div>
                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  {g.items.map((p) => (
                    <EpisodeCard key={p.id} p={p} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
