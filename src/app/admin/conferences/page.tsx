import { loadAllConferences } from "@/lib/conferences";
import { createConference, deleteConference } from "./actions";

export const dynamic = "force-dynamic";

function fmt(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ConferencesPage() {
  const conferences = await loadAllConferences();
  const now = Date.now();

  return (
    <div className="reveal">
      <p className="eyebrow eyebrow-gold">// EVENTS</p>
      <h1 className="display-lg mt-2 text-foreground">Conferences &amp; trainings</h1>
      <p className="mt-2 text-[15px] text-muted">
        Promote upcoming in-person and live events to members on their dashboard.
      </p>

      {/* Create */}
      <div className="panel rule-top mt-6 p-5">
        <p className="eyebrow eyebrow-muted">Add an event</p>
        <form action={createConference} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="eyebrow eyebrow-muted">Name</span>
            <input name="name" required className="field" placeholder="Techno Security & Digital Forensics" />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Starts</span>
            <input type="datetime-local" name="startsAt" required className="field" />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Ends (optional)</span>
            <input type="datetime-local" name="endsAt" className="field" />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Location</span>
            <input name="location" className="field" placeholder="Wilmington, NC" />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Link</span>
            <input name="url" className="field" placeholder="https://…" />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="eyebrow eyebrow-muted">About</span>
            <textarea name="about" rows={2} className="field" placeholder="Short description of the event." />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Audience</span>
            <select name="audience" className="field" defaultValue="">
              <option value="">Both sides</option>
              <option value="LE">Law Enforcement only</option>
              <option value="CIVILIAN">Civilian only</option>
            </select>
          </label>
          <div className="flex items-end sm:col-span-2">
            <button type="submit" className="btn btn-primary">
              Add event
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="mt-6 grid gap-3">
        {conferences.length === 0 ? (
          <p className="text-muted">No events yet. Add your first above.</p>
        ) : (
          conferences.map((c) => {
            const past = (c.endsAt ?? c.startsAt).getTime() < now;
            return (
              <div
                key={c.id}
                className={`panel rule-top flex flex-wrap items-start justify-between gap-4 p-5 ${
                  past ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="display-sm text-foreground">{c.name}</h2>
                    <span
                      className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                        c.audience === "CIVILIAN"
                          ? "border-purple/40 text-purple bg-[rgba(168,85,247,0.08)]"
                          : c.audience === "LE"
                          ? "border-accent-bright/40 text-accent-bright bg-[rgba(0,180,216,0.06)]"
                          : "border-border text-muted"
                      }`}
                    >
                      {c.audience ?? "Both"}
                    </span>
                    {past ? (
                      <span className="border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                        Past
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-mono text-[12px] text-accent-bright">
                    {fmt(c.startsAt)}
                    {c.endsAt ? ` — ${fmt(c.endsAt)}` : ""}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-muted">
                    {c.location || "Location TBD"}
                  </p>
                  {c.about ? <p className="mt-2 text-[14px] text-muted">{c.about}</p> : null}
                  {c.url ? (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block font-mono text-[12px] text-accent-bright hover:underline"
                    >
                      {c.url} ↗
                    </a>
                  ) : null}
                </div>
                <form action={deleteConference}>
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    type="submit"
                    className="btn btn-ghost btn-sm border-danger/40 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)] hover:text-danger"
                  >
                    Delete
                  </button>
                </form>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
