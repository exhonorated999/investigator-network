import { loadAllGrants, GRANT_CATEGORY_LABEL } from "@/lib/grants";
import { GrantForm } from "./grant-form";
import {
  createGrant,
  updateGrant,
  deleteGrant,
  toggleGrantPublished,
} from "./actions";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "No due date";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "No due date"
    : d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

export default async function GrantsAdminPage() {
  const grants = await loadAllGrants();

  return (
    <div className="reveal">
      <p className="eyebrow eyebrow-gold">// LAW ENFORCEMENT FUNDING</p>
      <h1 className="display-lg mt-2 text-foreground">LE Grants</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-muted">
        Funding opportunities LE members can use toward our Investigations
        software, DFIR (Datapilot), or the SO-management symposium. Paste a grant
        link and the details pre-fill from the page — review, tag relevance, then
        publish. Only Law Enforcement members see published grants.
      </p>

      {/* Create */}
      <div className="panel rule-top mt-6 p-5">
        <p className="eyebrow eyebrow-muted">Add a grant</p>
        <div className="mt-4">
          <GrantForm action={createGrant} submitLabel="Add grant" resetOnSave />
        </div>
      </div>

      {/* List */}
      <div className="mt-8">
        <div className="flex items-center gap-3">
          <h2 className="display-sm text-foreground">Grants</h2>
          <span className="font-mono text-[11px] text-muted">
            {String(grants.length).padStart(2, "0")}
          </span>
        </div>
        <div className="panel rule-top mt-3 divide-y divide-border">
          {grants.length === 0 ? (
            <p className="p-4 text-[14px] text-muted">No grants yet.</p>
          ) : (
            grants.map((g) => (
              <div key={g.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] text-foreground">{g.title}</h3>
                      <span
                        className={`tag-chip ${
                          g.published ? "tag-chip-cyan" : ""
                        }`}
                      >
                        {g.published ? "Published" : "Draft"}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[12px] text-muted">
                      Due {fmtDate(g.dueDate)}
                      {g.grantingAgency ? ` · ${g.grantingAgency}` : ""}
                    </p>
                    {g.categories.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {g.categories.map((c) => (
                          <span key={c} className="tag-chip">
                            {GRANT_CATEGORY_LABEL[c]}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <a
                      href={g.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block break-all font-mono text-[12px] text-accent-bright hover:underline"
                    >
                      {g.url} ↗
                    </a>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <form action={toggleGrantPublished}>
                      <input type="hidden" name="id" value={g.id} />
                      <button type="submit" className="btn btn-ghost btn-sm">
                        {g.published ? "Unpublish" : "Publish"}
                      </button>
                    </form>
                    <form action={deleteGrant}>
                      <input type="hidden" name="id" value={g.id} />
                      <button
                        type="submit"
                        className="btn btn-ghost btn-sm border-danger/40 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)] hover:text-danger"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-muted hover:text-foreground">
                    Edit
                  </summary>
                  <div className="mt-3 border-l-2 border-border pl-4">
                    <GrantForm
                      action={updateGrant}
                      submitLabel="Save changes"
                      initial={{
                        id: g.id,
                        title: g.title,
                        url: g.url,
                        grantingAgency: g.grantingAgency,
                        qualifyingAgency: g.qualifyingAgency,
                        summary: g.summary,
                        dueDate: g.dueDate ? g.dueDate.slice(0, 10) : "",
                        categories: g.categories,
                        published: g.published,
                      }}
                    />
                  </div>
                </details>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
