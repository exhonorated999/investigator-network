import { loadAllPartners, loadPartnerClickStats, PARTNER_TIERS } from "@/lib/partners";
import {
  createPartner,
  updatePartner,
  deletePartner,
  togglePartnerActive,
} from "./actions";

export const dynamic = "force-dynamic";

const AUDIENCE_CHIP: Record<string, string> = {
  CIVILIAN: "border-purple/40 text-purple bg-[rgba(168,85,247,0.08)]",
  LE: "border-accent-bright/40 text-accent-bright bg-[rgba(0,180,216,0.06)]",
  BOTH: "border-border text-muted",
};

export default async function PartnersAdminPage() {
  const partners = await loadAllPartners();
  const clickStats = await loadPartnerClickStats();

  const grouped = PARTNER_TIERS.map((t) => ({
    ...t,
    items: partners.filter((p) => p.tier === t.id),
  }));

  const now = new Date();
  const periodLabels = {
    month: now.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    quarter: `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`,
    year: String(now.getFullYear()),
  };
  // Partners with any activity first, then alphabetical — the ROI table.
  const statRows = [...partners]
    .map((p) => ({
      p,
      s: clickStats.get(p.id) ?? { partnerId: p.id, month: 0, quarter: 0, year: 0, allTime: 0 },
    }))
    .sort((a, b) => b.s.allTime - a.s.allTime || a.p.name.localeCompare(b.p.name));
  const totals = statRows.reduce(
    (acc, { s }) => ({
      month: acc.month + s.month,
      quarter: acc.quarter + s.quarter,
      year: acc.year + s.year,
      allTime: acc.allTime + s.allTime,
    }),
    { month: 0, quarter: 0, year: 0, allTime: 0 }
  );

  return (
    <div className="reveal">
      <p className="eyebrow eyebrow-gold">// PARTNERS</p>
      <h1 className="display-lg mt-2 text-foreground">Partners</h1>
      <p className="mt-2 text-[15px] text-muted">
        Curate the vendors and organizations you partner with. Featured partners
        rotate in the dashboard &ldquo;Partner Spotlight&rdquo; card and sort to the
        top of the{" "}
        <a href="/partners" className="text-accent-bright hover:underline">
          Partners directory
        </a>
        . Placements are always labeled &mdash; no popups, no content-blocking ads.
      </p>

      {/* Click metrics — ROI for sponsors */}
      <div className="panel rule-top mt-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow eyebrow-gold">Engagement</p>
            <h2 className="display-sm mt-1 text-foreground">Ad clicks</h2>
          </div>
          <p className="max-w-md text-[13px] text-muted">
            Every click on a partner&rsquo;s spotlight card or directory listing is
            counted. Share these with sponsors to show return on investment.
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-4 eyebrow eyebrow-muted font-normal">Partner</th>
                <th className="py-2 px-3 text-right eyebrow eyebrow-muted font-normal">
                  {periodLabels.month}
                </th>
                <th className="py-2 px-3 text-right eyebrow eyebrow-muted font-normal">
                  {periodLabels.quarter}
                </th>
                <th className="py-2 px-3 text-right eyebrow eyebrow-muted font-normal">
                  {periodLabels.year}
                </th>
                <th className="py-2 pl-3 text-right eyebrow eyebrow-muted font-normal">
                  All time
                </th>
              </tr>
            </thead>
            <tbody>
              {statRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-[14px] text-muted">
                    No partners yet.
                  </td>
                </tr>
              ) : (
                statRows.map(({ p, s }) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-4">
                      <span className="text-[14px] text-foreground">{p.name}</span>
                      {!p.active ? (
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-danger">
                          hidden
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[14px] text-foreground">
                      {s.month}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[14px] text-foreground">
                      {s.quarter}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[14px] text-foreground">
                      {s.year}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono text-[14px] font-semibold text-accent-bright">
                      {s.allTime}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {statRows.length > 0 ? (
              <tfoot>
                <tr>
                  <td className="py-2.5 pr-4 eyebrow eyebrow-muted">Total</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[14px] text-muted">
                    {totals.month}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-[14px] text-muted">
                    {totals.quarter}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-[14px] text-muted">
                    {totals.year}
                  </td>
                  <td className="py-2.5 pl-3 text-right font-mono text-[14px] text-muted">
                    {totals.allTime}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>

      {/* Create */}
      <div className="panel rule-top mt-6 p-5">
        <p className="eyebrow eyebrow-muted">Add a partner</p>
        <form
          action={createPartner}
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Name</span>
            <input name="name" required className="field" placeholder="DataPilot" />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Tier</span>
            <select name="tier" className="field" defaultValue="STANDARD">
              {PARTNER_TIERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="eyebrow eyebrow-muted">Link</span>
            <input name="url" required className="field" placeholder="https://…" />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="eyebrow eyebrow-muted">One-line value proposition</span>
            <textarea
              name="blurb"
              rows={2}
              className="field"
              placeholder="Mobile forensic extraction trusted by law enforcement worldwide."
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
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="eyebrow eyebrow-muted">Logo URL (static asset or https)</span>
            <input
              name="logoUrl"
              className="field"
              placeholder="/partner-logos/acme.png  or  https://…"
            />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="eyebrow eyebrow-muted">…or upload a logo (PNG/SVG, transparent preferred)</span>
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="field"
            />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" name="active" defaultChecked className="h-4 w-4" />
            <span className="text-[14px] text-muted">Active (visible to members)</span>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary btn-sm">
              Add partner
            </button>
          </div>
        </form>
      </div>

      {/* List, grouped by tier */}
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
                <p className="p-4 text-[14px] text-muted">No {g.label.toLowerCase()} partners.</p>
              ) : (
                g.items.map((p) => (
                  <div key={p.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        {(p.logoUrl && p.logoUrl.trim()) || p.logoFileId ? (
                          <img
                            src={
                              (p.logoUrl && p.logoUrl.trim()) ||
                              `/api/files/${p.logoFileId}`
                            }
                            alt={p.name}
                            width={44}
                            height={44}
                            className="h-11 w-11 shrink-0 rounded border border-border bg-white object-contain p-1"
                          />
                        ) : (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-border bg-surface font-display text-lg text-muted">
                            {p.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[15px] text-foreground">{p.name}</h3>
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
                              #{p.sortOrder}
                            </span>
                          </div>
                          {p.blurb ? (
                            <p className="mt-1 text-[14px] text-muted">{p.blurb}</p>
                          ) : null}
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block break-all font-mono text-[12px] text-accent-bright hover:underline"
                          >
                            {p.url} ↗
                          </a>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <form action={togglePartnerActive}>
                          <input type="hidden" name="id" value={p.id} />
                          <button type="submit" className="btn btn-ghost btn-sm">
                            {p.active ? "Hide" : "Show"}
                          </button>
                        </form>
                        <form action={deletePartner}>
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
                      <form
                        action={updatePartner}
                        className="mt-3 grid gap-3 sm:grid-cols-2"
                      >
                        <input type="hidden" name="id" value={p.id} />
                        <label className="grid gap-1.5">
                          <span className="eyebrow eyebrow-muted">Name</span>
                          <input name="name" required className="field" defaultValue={p.name} />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="eyebrow eyebrow-muted">Tier</span>
                          <select name="tier" className="field" defaultValue={p.tier}>
                            {PARTNER_TIERS.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-1.5 sm:col-span-2">
                          <span className="eyebrow eyebrow-muted">Link</span>
                          <input name="url" required className="field" defaultValue={p.url} />
                        </label>
                        <label className="grid gap-1.5 sm:col-span-2">
                          <span className="eyebrow eyebrow-muted">One-line value proposition</span>
                          <textarea
                            name="blurb"
                            rows={2}
                            className="field"
                            defaultValue={p.blurb}
                          />
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
                          <span className="eyebrow eyebrow-muted">Logo URL (static asset or https)</span>
                          <input
                            name="logoUrl"
                            className="field"
                            defaultValue={p.logoUrl ?? ""}
                            placeholder="/partner-logos/acme.png  or  https://…"
                          />
                        </label>
                        <label className="grid gap-1.5 sm:col-span-2">
                          <span className="eyebrow eyebrow-muted">
                            …or replace logo by upload (leave empty to keep current)
                          </span>
                          <input
                            type="file"
                            name="logo"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
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
        ))}
      </div>
    </div>
  );
}
