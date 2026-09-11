import { loadIspProviders } from "@/lib/isp";
import { createIspProvider, deleteIspProvider } from "./actions";

export const dynamic = "force-dynamic";

export default async function IspAdminPage() {
  const providers = await loadIspProviders();

  return (
    <div className="reveal">
      <p className="eyebrow eyebrow-gold">// SERVICE OF PROCESS</p>
      <h1 className="display-lg mt-2 text-foreground">ISP / provider directory</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-muted">
        Where to serve legal process (search warrants, subpoenas) to internet
        service providers &amp; platforms. Members add this as a &ldquo;Service of
        Process&rdquo; card on their dashboard. The list is always shown
        alphabetically. Provide a portal link, an email, or both.
      </p>

      {/* Create */}
      <div className="panel rule-top mt-6 p-5">
        <p className="eyebrow eyebrow-muted">Add a provider</p>
        <form action={createIspProvider} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Provider name</span>
            <input name="name" required className="field" placeholder="AT&T" />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Portal link (optional)</span>
            <input name="url" className="field" placeholder="https://app.kodexglobal.com/att-inc/signin" />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Email (optional)</span>
            <input name="email" className="field" placeholder="records@offerup.com" />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Note (optional)</span>
            <input name="note" className="field" placeholder="submitted via email" />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary btn-sm">
              Add provider
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="mt-8">
        <div className="flex items-center gap-3">
          <h2 className="display-sm text-foreground">Providers</h2>
          <span className="font-mono text-[11px] text-muted">
            {String(providers.length).padStart(2, "0")}
          </span>
        </div>
        <div className="panel rule-top mt-3 divide-y divide-border">
          {providers.length === 0 ? (
            <p className="p-4 text-[14px] text-muted">No providers yet.</p>
          ) : (
            providers.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <h3 className="text-[15px] text-foreground">{p.name}</h3>
                  {p.url ? (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block break-all font-mono text-[12px] text-accent-bright hover:underline"
                    >
                      {p.url} ↗
                    </a>
                  ) : null}
                  {p.email ? (
                    <p className="mt-0.5 break-all font-mono text-[12px] text-muted">
                      {p.email}
                    </p>
                  ) : null}
                  {p.note ? (
                    <p className="mt-0.5 text-[13px] text-muted">{p.note}</p>
                  ) : null}
                </div>
                <form action={deleteIspProvider}>
                  <input type="hidden" name="id" value={p.id} />
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
    </div>
  );
}
