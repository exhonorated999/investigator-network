import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  loadCampaignStats,
  previewAudience,
  type CampaignStat,
} from "@/lib/campaigns";
import {
  updateCampaign,
  deleteCampaign,
  sendTestAction,
  sendCampaignAction,
  scheduleCampaign,
  unscheduleCampaign,
} from "../actions";
import { ScheduleForm } from "./schedule-form";
import { LocalTime } from "./local-time";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, string> = {
  DRAFT: "border-border text-muted",
  SCHEDULED: "border-gold/40 text-gold bg-[rgba(244,162,97,0.08)]",
  SENDING: "border-accent-bright/40 text-accent-bright bg-[rgba(0,180,216,0.06)]",
  SENT: "border-success/40 text-success bg-[rgba(74,222,128,0.08)]",
  FAILED: "border-danger/40 text-danger bg-[rgba(239,68,68,0.08)]",
};

function pct(n: number, d: number): string {
  if (d <= 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

function MetricsPanel({ stat }: { stat: CampaignStat }) {
  const cards = [
    { label: "Recipients", value: stat.total, sub: "", tone: "text-foreground" },
    { label: "Sent", value: stat.sent, sub: "", tone: "text-foreground" },
    { label: "Delivered", value: stat.delivered, sub: pct(stat.delivered, stat.sent), tone: "text-success" },
    { label: "Bounced", value: stat.bounced, sub: pct(stat.bounced, stat.sent), tone: "text-warning" },
    { label: "Opened", value: stat.opened, sub: pct(stat.opened, stat.delivered), tone: "text-accent-bright" },
    { label: "Clicked", value: stat.clicked, sub: pct(stat.clicked, stat.delivered), tone: "text-accent-bright" },
    { label: "Complaints", value: stat.complained, sub: "", tone: "text-danger" },
    { label: "Failed", value: stat.failed, sub: "", tone: "text-danger" },
  ];
  return (
    <div className="panel rule-top mt-6 p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow eyebrow-gold">Engagement</p>
          <h2 className="display-sm mt-1 text-foreground">Delivery & response</h2>
        </div>
        <p className="max-w-xs text-[12px] text-muted">
          Open/click figures require open &amp; click tracking to be enabled on
          your Resend domain and the webhook connected.
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label}>
            <p className={`font-display text-3xl font-black leading-none ${c.tone}`}>{c.value}</p>
            <p className="eyebrow eyebrow-muted mt-2">
              {c.label}
              {c.sub ? <span className="ml-1 text-muted/70">· {c.sub}</span> : null}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) notFound();

  const isDraft = campaign.status === "DRAFT";
  const [stat, preview] = await Promise.all([
    loadCampaignStats(id),
    previewAudience(campaign),
  ]);

  return (
    <div className="reveal">
      <Link href="/admin/campaigns" className="font-mono text-[11px] text-muted hover:text-accent-bright">
        ← All campaigns
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${STATUS_CHIP[campaign.status]}`}>
          {campaign.status}
        </span>
        {campaign.sentAt ? (
          <span className="font-mono text-[11px] text-muted">
            Sent <LocalTime iso={campaign.sentAt.toISOString()} />
          </span>
        ) : null}
        {campaign.status === "SCHEDULED" && campaign.scheduledAt ? (
          <span className="font-mono text-[11px] text-gold">
            Scheduled for <LocalTime iso={campaign.scheduledAt.toISOString()} />
          </span>
        ) : null}
      </div>
      <h1 className="display-lg mt-2 text-foreground">{campaign.subject}</h1>

      {/* Rendered preview */}
      <div className="panel rule-top mt-6 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow eyebrow-gold">Preview</p>
            <h2 className="display-sm mt-1 text-foreground">As recipients see it</h2>
          </div>
          <a
            href={`/api/admin/campaigns/${campaign.id}/preview`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
          >
            Open in new tab ↗
          </a>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-white">
          <iframe
            src={`/api/admin/campaigns/${campaign.id}/preview`}
            title="Email preview"
            className="h-[640px] w-full"
          />
        </div>
      </div>

      {/* Metrics — always visible; meaningful after send */}
      <MetricsPanel stat={stat} />

      {/* Audience preview */}
      <div className="panel rule-top mt-6 p-5">
        <p className="eyebrow eyebrow-muted">Audience {isDraft ? "(preview)" : "(as sent)"}</p>
        <p className="mt-2 text-[15px] text-foreground">
          <span className="font-display text-2xl font-black text-accent-bright">{preview.total}</span>{" "}
          recipients
          <span className="ml-2 text-[13px] text-muted">
            — {preview.members} members · {preview.contacts} contacts (deduped, suppression removed)
          </span>
        </p>
        <p className="mt-2 text-[12px] text-muted">
          Targets: {campaign.includeMembers ? `members${campaign.memberAudience ? ` (${campaign.memberAudience})` : ""}` : "no members"}
          {" · "}
          {campaign.includeContacts ? "contacts" : "no contacts"}
        </p>
      </div>

      {isDraft ? (
        <>
          {/* Send */}
          <div className="panel rule-top mt-6 border-gold/30 bg-[rgba(244,162,97,0.05)] p-5">
            <p className="eyebrow eyebrow-gold">Send campaign</p>
            <p className="mt-2 max-w-2xl text-[13px] text-muted">
              This sends immediately to all {preview.total} recipients and cannot be
              undone. Send a test to yourself first. Type <strong>SEND</strong> to confirm.
            </p>

            <form action={sendTestAction} className="mt-4 flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={campaign.id} />
              <label className="grid gap-1.5">
                <span className="eyebrow eyebrow-muted">Test to</span>
                <input name="testEmail" type="email" required className="field w-64" placeholder="you@intellect-le.com" />
              </label>
              <button type="submit" className="btn btn-ghost btn-sm">Send test</button>
            </form>

            <form action={sendCampaignAction} className="mt-4 flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={campaign.id} />
              <label className="grid gap-1.5">
                <span className="eyebrow eyebrow-muted">Type SEND to confirm</span>
                <input name="confirm" required className="field w-40" placeholder="SEND" autoComplete="off" />
              </label>
              <button type="submit" className="btn btn-primary btn-sm">
                Send to {preview.total} recipients
              </button>
            </form>

            <div className="mt-6 rule-top pt-5">
              <p className="eyebrow eyebrow-muted">Or schedule for later</p>
              <p className="mt-2 max-w-2xl text-[13px] text-muted">
                Pick a future date/time (up to 30 days out). The campaign stays a
                draft until then; you can cancel any time before it fires.
              </p>
              <ScheduleForm
                action={scheduleCampaign}
                campaignId={campaign.id}
                total={preview.total}
              />
            </div>
          </div>

          {/* Edit */}
          <div className="panel rule-top mt-6 p-5">
            <p className="eyebrow eyebrow-muted">Edit draft</p>
            <form action={updateCampaign} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={campaign.id} />
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="eyebrow eyebrow-muted">Subject line</span>
                <input name="subject" required className="field" defaultValue={campaign.subject} />
              </label>
              <label className="grid gap-1.5">
                <span className="eyebrow eyebrow-muted">Preheader</span>
                <input name="preheader" className="field" defaultValue={campaign.preheader} />
              </label>
              <label className="grid gap-1.5">
                <span className="eyebrow eyebrow-muted">From name</span>
                <input name="fromName" className="field" defaultValue={campaign.fromName} />
              </label>
              <fieldset className="grid gap-2 rounded-lg border border-border p-3 sm:col-span-2">
                <legend className="eyebrow eyebrow-muted px-1">Audience</legend>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="includeMembers" defaultChecked={campaign.includeMembers} className="h-4 w-4" />
                  <span className="text-[14px] text-muted">Members</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="eyebrow eyebrow-muted">Limit members to</span>
                  <select name="memberAudience" className="field max-w-[220px]" defaultValue={campaign.memberAudience ?? ""}>
                    <option value="">Both sides</option>
                    <option value="LE">Law enforcement</option>
                    <option value="CIVILIAN">Civilian / PI</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="includeContacts" defaultChecked={campaign.includeContacts} className="h-4 w-4" />
                  <span className="text-[14px] text-muted">Non-member contacts</span>
                </label>
              </fieldset>
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="eyebrow eyebrow-muted">Body HTML</span>
                <textarea name="bodyHtml" required rows={12} className="field font-mono text-[13px]" defaultValue={campaign.bodyHtml} />
              </label>
              <div className="sm:col-span-2">
                <button type="submit" className="btn btn-primary btn-sm">Save draft</button>
              </div>
            </form>
          </div>

          {/* Danger */}
          <form action={deleteCampaign} className="mt-6">
            <input type="hidden" name="id" value={campaign.id} />
            <button
              type="submit"
              className="btn btn-ghost btn-sm border-danger/40 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)] hover:text-danger"
            >
              Delete draft
            </button>
          </form>
        </>
      ) : campaign.status === "SCHEDULED" ? (
        <div className="panel rule-top mt-6 border-gold/30 bg-[rgba(244,162,97,0.05)] p-5">
          <p className="eyebrow eyebrow-gold">Scheduled</p>
          <p className="mt-2 text-[15px] text-foreground">
            Sending to{" "}
            <span className="font-display text-xl font-black text-accent-bright">
              {preview.total}
            </span>{" "}
            recipients on{" "}
            <strong className="text-gold">
              {campaign.scheduledAt ? (
                <LocalTime iso={campaign.scheduledAt.toISOString()} />
              ) : (
                "—"
              )}
            </strong>
            .
          </p>
          <p className="mt-2 max-w-2xl text-[12px] text-muted">
            The cron worker dispatches due campaigns. Cancel to return this to an
            editable draft.
          </p>
          <form action={unscheduleCampaign} className="mt-4">
            <input type="hidden" name="id" value={campaign.id} />
            <button type="submit" className="btn btn-ghost btn-sm">
              Cancel schedule → back to draft
            </button>
          </form>
        </div>
      ) : (
        <div className="panel rule-top mt-6 p-5">
          <p className="eyebrow eyebrow-muted">Body HTML (as sent)</p>
          <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-border bg-void p-3 font-mono text-[12px] text-muted">
            {campaign.bodyHtml}
          </pre>
        </div>
      )}
    </div>
  );
}
