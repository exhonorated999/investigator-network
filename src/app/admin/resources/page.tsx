import { loadAllResources, RESOURCE_CATEGORIES } from "@/lib/resources";
import { createResource, deleteResource } from "./actions";

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
  const resources = await loadAllResources();

  // Group by category for the management list.
  const grouped = RESOURCE_CATEGORIES.map((c) => ({
    ...c,
    items: resources.filter((r) => r.category === c.id),
  }));

  return (
    <div className="reveal">
      <p className="eyebrow eyebrow-gold">// FIELD KIT</p>
      <h1 className="display-lg mt-2 text-foreground">Free tools &amp; resources</h1>
      <p className="mt-2 text-[15px] text-muted">
        Curate external tools members can toggle by discipline on their dashboard
        &ldquo;Tools &amp; resources&rdquo; card.
      </p>

      {/* Create */}
      <div className="panel rule-top mt-6 p-5">
        <p className="eyebrow eyebrow-muted">Add a resource</p>
        <form action={createResource} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Name</span>
            <input name="name" required className="field" placeholder="Autopsy" />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Category</span>
            <select name="category" required className="field" defaultValue="DFIR">
              {RESOURCE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="eyebrow eyebrow-muted">Link</span>
            <input name="url" required className="field" placeholder="https://…" />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="eyebrow eyebrow-muted">Description</span>
            <textarea
              name="description"
              rows={2}
              className="field"
              placeholder="Open-source digital forensics platform for disk & mobile analysis."
            />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Audience</span>
            <select name="audience" className="field" defaultValue="">
              <option value="">Both</option>
              <option value="LE">Law enforcement</option>
              <option value="CIVILIAN">Civilian / PI</option>
            </select>
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
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary btn-sm">
              Add resource
            </button>
          </div>
        </form>
      </div>

      {/* List, grouped by category */}
      <div className="mt-8 grid gap-8">
        {grouped.map((g) => (
          <div key={g.id}>
            <div className="flex items-center gap-3">
              <h2 className="display-sm text-foreground">{g.label}</h2>
              <span className="font-mono text-[11px] text-muted">
                {String(g.items.length).padStart(2, "0")}
              </span>
            </div>
            <div className="panel rule-top mt-3 divide-y divide-border">
              {g.items.length === 0 ? (
                <p className="p-4 text-[14px] text-muted">No resources in this category.</p>
              ) : (
                g.items.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start justify-between gap-4 p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] text-foreground">{r.name}</h3>
                        <span
                          className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                            r.audience === "CIVILIAN"
                              ? "border-purple/40 text-purple bg-[rgba(168,85,247,0.08)]"
                              : r.audience === "LE"
                              ? "border-accent-bright/40 text-accent-bright bg-[rgba(0,180,216,0.06)]"
                              : "border-border text-muted"
                          }`}
                        >
                          {r.audience ?? "Both"}
                        </span>
                      </div>
                      {r.description ? (
                        <p className="mt-1 text-[14px] text-muted">{r.description}</p>
                      ) : null}
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block break-all font-mono text-[12px] text-accent-bright hover:underline"
                      >
                        {r.url} ↗
                      </a>
                    </div>
                    <form action={deleteResource}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        type="submit"
                        className="btn btn-ghost btn-sm border-danger/40 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)] hover:text-danger"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
