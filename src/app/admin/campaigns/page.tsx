import Link from "next/link";
import { loadAllCampaigns } from "@/lib/campaigns";
import { createCampaign } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, string> = {
  DRAFT: "border-border text-muted",
  SENDING: "border-accent-bright/40 text-accent-bright bg-[rgba(0,180,216,0.06)]",
  SENT: "border-success/40 text-success bg-[rgba(74,222,128,0.08)]",
  FAILED: "border-danger/40 text-danger bg-[rgba(239,68,68,0.08)]",
};

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function CampaignsAdminPage() {
  const campaigns = await loadAllCampaigns();

  return (
    <div className="reveal">
      <p className="eyebrow eyebrow-gold">// CAMPAIGNS</p>
      <h1 className="display-lg mt-2 text-foreground">Email campaigns</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-muted">
        Quarterly newsletters and announcements to members and{" "}
        <a href="/admin/contacts" className="text-accent-bright hover:underline">
          contacts
        </a>
        . Paste the body HTML — the system wraps it in the Investigator Network
        template and adds the required unsubscribe link + mailing address.
        Delivery, bounces, opens and clicks are tracked per campaign.
      </p>

      {/* Create */}
      <div className="panel rule-top mt-6 p-5">
        <p className="eyebrow eyebrow-muted">New campaign (saved as draft)</p>
        <form action={createCampaign} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="eyebrow eyebrow-muted">Subject line</span>
            <input name="subject" required className="field" placeholder="Q3 Briefing: New rulings, classes & tools" />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Preheader (inbox preview)</span>
            <input name="preheader" className="field" placeholder="This quarter at Investigator Network…" />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">From name (optional)</span>
            <input name="fromName" className="field" placeholder="Investigator Network" />
          </label>
          <fieldset className="grid gap-2 rounded-lg border border-border p-3 sm:col-span-2">
            <legend className="eyebrow eyebrow-muted px-1">Audience</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="includeMembers" defaultChecked className="h-4 w-4" />
              <span className="text-[14px] text-muted">Members</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="eyebrow eyebrow-muted">Limit members to</span>
              <select name="memberAudience" className="field max-w-[220px]" defaultValue="">
                <option value="">Both sides</option>
                <option value="LE">Law enforcement</option>
                <option value="CIVILIAN">Civilian / PI</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="includeContacts" defaultChecked className="h-4 w-4" />
              <span className="text-[14px] text-muted">Non-member contacts</span>
            </label>
          </fieldset>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="eyebrow eyebrow-muted">Body HTML</span>
            <textarea
              name="bodyHtml"
              required
              rows={8}
              className="field font-mono text-[13px]"
              placeholder="<h1>Heading</h1><p>Paste the campaign body HTML here…</p>"
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary btn-sm">
              Create draft
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="mt-8">
        <div className="flex items-center gap-3">
          <h2 className="display-sm text-foreground">All campaigns</h2>
          <span className="font-mono text-[11px] text-muted">
            {String(campaigns.length).padStart(2, "0")}
          </span>
        </div>
        <div className="panel rule-top mt-3 divide-y divide-border">
          {campaigns.length === 0 ? (
            <p className="p-4 text-[14px] text-muted">No campaigns yet.</p>
          ) : (
            campaigns.map((c) => (
              <Link
                key={c.id}
                href={`/admin/campaigns/${c.id}`}
                className="flex items-center justify-between gap-4 p-4 transition hover:bg-surface/50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${STATUS_CHIP[c.status]}`}
                    >
                      {c.status}
                    </span>
                    <span className="font-mono text-[10px] text-muted">
                      {c.sentAt ? `Sent ${fmtDate(c.sentAt)}` : `Created ${fmtDate(c.createdAt)}`}
                    </span>
                  </div>
                  <h3 className="mt-1 truncate text-[15px] text-foreground">{c.subject}</h3>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-accent-bright">Open →</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
