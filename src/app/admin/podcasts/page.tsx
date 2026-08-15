import {
  loadAllPodcasts,
  PODCAST_CATEGORIES,
  PODCAST_DISCLAIMER,
} from "@/lib/podcasts";
import {
  createPodcast,
  updatePodcast,
  deletePodcast,
  togglePodcastActive,
} from "./actions";

export const dynamic = "force-dynamic";

const AUDIENCE_CHIP: Record<string, string> = {
  CIVILIAN: "border-purple/40 text-purple bg-[rgba(168,85,247,0.08)]",
  LE: "border-accent-bright/40 text-accent-bright bg-[rgba(0,180,216,0.06)]",
  BOTH: "border-border text-muted",
};

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function PodcastsAdminPage() {
  const podcasts = await loadAllPodcasts();

  return (
    <div className="reveal">
      <p className="eyebrow eyebrow-gold">// PODCASTS</p>
      <h1 className="display-lg mt-2 text-foreground">Case-law podcasts</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-muted">
        AI-generated audio explainers that translate court rulings into
        plain-language guidance. Upload the audio, link the ruling, and add a
        brief description. Episodes surface in the dashboard &ldquo;Case-law
        Podcasts&rdquo; card and on the{" "}
        <a href="/podcasts" className="text-accent-bright hover:underline">
          podcast library
        </a>
        .
      </p>

      <div className="panel rule-top mt-5 border-gold/30 bg-[rgba(212,175,55,0.05)] p-4">
        <p className="eyebrow eyebrow-gold">Disclaimer shown to members</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          {PODCAST_DISCLAIMER}
        </p>
      </div>

      {/* Create */}
      <div className="panel rule-top mt-6 p-5">
        <p className="eyebrow eyebrow-muted">Add an episode</p>
        <form action={createPodcast} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="eyebrow eyebrow-muted">Title</span>
            <input
              name="title"
              required
              className="field"
              placeholder="Riley v. California — warrant needed for phone searches"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Category</span>
            <select name="category" className="field" defaultValue="General Investigations">
              {PODCAST_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Audience</span>
            <select name="audience" className="field" defaultValue="">
              <option value="">Both</option>
              <option value="LE">Law enforcement</option>
              <option value="CIVILIAN">Civilian / PI</option>
            </select>
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="eyebrow eyebrow-muted">Court ruling link</span>
            <input
              name="rulingUrl"
              className="field"
              placeholder="https://… (optional but recommended)"
            />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="eyebrow eyebrow-muted">Brief description</span>
            <textarea
              name="description"
              rows={3}
              className="field"
              placeholder="What the ruling changes for day-to-day investigations, in plain language."
            />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Sort order</span>
            <input
              type="number"
              name="sortOrder"
              className="field"
              defaultValue={0}
              placeholder="0"
            />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="eyebrow eyebrow-muted">Audio file (MP3 / M4A / WAV)</span>
            <input
              type="file"
              name="audio"
              required
              accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/aac,audio/ogg,.mp3,.m4a,.wav"
              className="field"
            />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" name="active" defaultChecked className="h-4 w-4" />
            <span className="text-[14px] text-muted">Active (visible to members)</span>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary btn-sm">
              Add episode
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="mt-8">
        <div className="flex items-center gap-3">
          <h2 className="display-sm text-foreground">Episodes</h2>
          <span className="font-mono text-[11px] text-muted">
            {String(podcasts.length).padStart(2, "0")}
          </span>
        </div>
        <div className="panel rule-top mt-3 divide-y divide-border">
          {podcasts.length === 0 ? (
            <p className="p-4 text-[14px] text-muted">No episodes yet.</p>
          ) : (
            podcasts.map((p) => (
              <div key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] text-foreground">{p.title}</h3>
                      <span className="border border-gold/40 bg-[rgba(212,175,55,0.08)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
                        {p.category}
                      </span>
                      <span
                        className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                          AUDIENCE_CHIP[p.audience ?? "BOTH"]
                        }`}
                      >
                        {p.audience ?? "Both"}
                      </span>
                      {!p.active ? (
                        <span className="border border-danger/40 bg-[rgba(239,68,68,0.08)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-danger">
                          Hidden
                        </span>
                      ) : null}
                      <span className="font-mono text-[10px] text-muted">
                        {fmtDate(p.publishedAt)}
                      </span>
                    </div>
                    {p.description ? (
                      <p className="mt-1 text-[14px] text-muted">{p.description}</p>
                    ) : null}
                    <div className="mt-2">
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <audio
                        controls
                        preload="none"
                        src={`/api/files/${p.audioFileId}`}
                        className="h-9 w-full max-w-md"
                      />
                    </div>
                    {p.rulingUrl ? (
                      <a
                        href={p.rulingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block break-all font-mono text-[12px] text-accent-bright hover:underline"
                      >
                        {p.rulingUrl} ↗
                      </a>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <form action={togglePodcastActive}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="btn btn-ghost btn-sm">
                        {p.active ? "Hide" : "Show"}
                      </button>
                    </form>
                    <form action={deletePodcast}>
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        type="submit"
                        className="btn btn-ghost btn-sm border-danger/40 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)] hover:text-danger"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>

                {/* Edit */}
                <details className="mt-3">
                  <summary className="cursor-pointer select-none font-mono text-[11px] uppercase tracking-[0.14em] text-muted hover:text-accent-bright">
                    Edit
                  </summary>
                  <form action={updatePodcast} className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="id" value={p.id} />
                    <label className="grid gap-1.5 sm:col-span-2">
                      <span className="eyebrow eyebrow-muted">Title</span>
                      <input name="title" required className="field" defaultValue={p.title} />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="eyebrow eyebrow-muted">Category</span>
                      <select name="category" className="field" defaultValue={p.category}>
                        {PODCAST_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1.5">
                      <span className="eyebrow eyebrow-muted">Audience</span>
                      <select
                        name="audience"
                        className="field"
                        defaultValue={p.audience ?? ""}
                      >
                        <option value="">Both</option>
                        <option value="LE">Law enforcement</option>
                        <option value="CIVILIAN">Civilian / PI</option>
                      </select>
                    </label>
                    <label className="grid gap-1.5 sm:col-span-2">
                      <span className="eyebrow eyebrow-muted">Court ruling link</span>
                      <input
                        name="rulingUrl"
                        className="field"
                        defaultValue={p.rulingUrl ?? ""}
                        placeholder="https://…"
                      />
                    </label>
                    <label className="grid gap-1.5 sm:col-span-2">
                      <span className="eyebrow eyebrow-muted">Brief description</span>
                      <textarea
                        name="description"
                        rows={3}
                        className="field"
                        defaultValue={p.description}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="eyebrow eyebrow-muted">Sort order</span>
                      <input
                        type="number"
                        name="sortOrder"
                        className="field"
                        defaultValue={p.sortOrder}
                      />
                    </label>
                    <label className="grid gap-1.5 sm:col-span-2">
                      <span className="eyebrow eyebrow-muted">
                        Replace audio (leave empty to keep current)
                      </span>
                      <input
                        type="file"
                        name="audio"
                        accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/aac,audio/ogg,.mp3,.m4a,.wav"
                        className="field"
                      />
                    </label>
                    <label className="flex items-center gap-2 sm:col-span-2">
                      <input
                        type="checkbox"
                        name="active"
                        defaultChecked={p.active}
                        className="h-4 w-4"
                      />
                      <span className="text-[14px] text-muted">Active (visible to members)</span>
                    </label>
                    <div className="sm:col-span-2">
                      <button type="submit" className="btn btn-primary btn-sm">
                        Save changes
                      </button>
                    </div>
                  </form>
                </details>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
