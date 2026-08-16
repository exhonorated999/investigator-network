import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { renderCampaignEmail, htmlToText, appUrl } from "@/lib/email-template";
import type { Campaign, Audience } from "@/generated/prisma";

/**
 * Bulk campaign engine (server-only): assemble a recipient list from members +
 * imported contacts (deduped, suppression honored) and send via Resend's batch
 * API, recording a CampaignRecipient row per address for webhook-driven
 * delivery/engagement tracking.
 */

const FROM_DEFAULT =
  process.env.EMAIL_FROM || "Investigator Network <justin@intellect-le.com>";

/** Split "Name <addr@x>" into parts; tolerate a bare address. */
function parseFrom(from: string): { name: string; address: string } {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (m) return { name: m[1].replace(/^"|"$/g, ""), address: m[2] };
  return { name: "", address: from.trim() };
}

/** Build the From header, applying an optional display-name override. */
function fromHeader(overrideName: string): string {
  const { name, address } = parseFrom(FROM_DEFAULT);
  const display = overrideName.trim() || name || "Investigator Network";
  return `${display} <${address}>`;
}

function newUnsubToken(): string {
  return randomBytes(18).toString("hex");
}

export interface AssembledRecipient {
  email: string;
  name: string;
  kind: "member" | "contact";
}

/**
 * Resolve the final recipient list for a campaign:
 * - members: APPROVED users, optionally limited to one audience
 * - contacts: SUBSCRIBED non-members
 * - dedupe: an address that is a member is never also sent as a contact
 * - suppression: any address on the global do-not-email list is removed
 * Emails are lowercased for matching; the display copy keeps first-seen name.
 */
export async function assembleRecipients(
  campaign: Pick<
    Campaign,
    "includeMembers" | "memberAudience" | "includeContacts"
  >
): Promise<AssembledRecipient[]> {
  const byEmail = new Map<string, AssembledRecipient>();

  if (campaign.includeMembers) {
    const where: {
      status: "APPROVED";
      audience?: Audience;
    } = { status: "APPROVED" };
    if (campaign.memberAudience) where.audience = campaign.memberAudience;
    const members = await prisma.user.findMany({
      where,
      select: { email: true, name: true },
    });
    for (const m of members) {
      const key = m.email.trim().toLowerCase();
      if (!key) continue;
      if (!byEmail.has(key)) {
        byEmail.set(key, { email: key, name: m.name ?? "", kind: "member" });
      }
    }
  }

  if (campaign.includeContacts) {
    const contacts = await prisma.contact.findMany({
      where: { status: "SUBSCRIBED" },
      select: { email: true, name: true },
    });
    for (const c of contacts) {
      const key = c.email.trim().toLowerCase();
      if (!key) continue;
      // Members take precedence — never double-send.
      if (!byEmail.has(key)) {
        byEmail.set(key, { email: key, name: c.name ?? "", kind: "contact" });
      }
    }
  }

  // Remove globally suppressed addresses.
  const suppressed = await prisma.suppression.findMany({
    select: { email: true },
  });
  for (const s of suppressed) byEmail.delete(s.email.trim().toLowerCase());

  return [...byEmail.values()];
}

/** Preview counts without creating rows or sending. */
export async function previewAudience(
  campaign: Pick<Campaign, "includeMembers" | "memberAudience" | "includeContacts">
): Promise<{ total: number; members: number; contacts: number }> {
  const list = await assembleRecipients(campaign);
  return {
    total: list.length,
    members: list.filter((r) => r.kind === "member").length,
    contacts: list.filter((r) => r.kind === "contact").length,
  };
}

interface BatchItem {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

/** POST one batch (<=100) to Resend; returns provider ids in order, or null. */
async function sendBatch(items: BatchItem[]): Promise<(string | null)[]> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Dev fallback — no external send; report a null id per item.
    console.log(`[campaign:dev] would send batch of ${items.length}`);
    return items.map(() => null);
  }
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(items),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`resend_batch_${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json().catch(() => ({}))) as {
    data?: { id?: string }[];
  };
  const data = json.data ?? [];
  return items.map((_, i) => data[i]?.id ?? null);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export interface SendOutcome {
  ok: boolean;
  total: number;
  sent: number;
  failed: number;
  error?: string;
}

/**
 * Send a DRAFT (immediate) or SCHEDULED (due) campaign. Idempotency: refuses to
 * send unless status is DRAFT or SCHEDULED. Creates CampaignRecipient rows first
 * (so a mid-send crash leaves an auditable trail), then dispatches in batches of
 * 100, mapping Resend ids back per row.
 */
export async function sendCampaign(campaignId: string): Promise<SendOutcome> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { ok: false, total: 0, sent: 0, failed: 0, error: "not_found" };
  if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
    return { ok: false, total: 0, sent: 0, failed: 0, error: "already_sent" };
  }

  const recipients = await assembleRecipients(campaign);
  if (recipients.length === 0) {
    return { ok: false, total: 0, sent: 0, failed: 0, error: "no_recipients" };
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "SENDING" },
  });

  // Create rows up-front (skip duplicates via unique [campaignId,email]).
  await prisma.campaignRecipient.createMany({
    data: recipients.map((r) => ({
      campaignId,
      email: r.email,
      name: r.name,
      kind: r.kind,
      unsubToken: newUnsubToken(),
    })),
    skipDuplicates: true,
  });

  const rows = await prisma.campaignRecipient.findMany({
    where: { campaignId },
    select: { id: true, email: true, name: true, unsubToken: true },
  });

  const from = fromHeader(campaign.fromName);
  const base = appUrl();
  let sent = 0;
  let failed = 0;

  for (const group of chunk(rows, 100)) {
    const items: BatchItem[] = group.map((row) => {
      const unsubscribeUrl = `${base}/api/unsubscribe?token=${row.unsubToken}`;
      const html = renderCampaignEmail({
        subject: campaign.subject,
        preheader: campaign.preheader,
        bodyHtml: campaign.bodyHtml,
        unsubscribeUrl,
      });
      return {
        from,
        to: [row.email],
        subject: campaign.subject,
        html,
        text: htmlToText(campaign.bodyHtml) + `\n\nUnsubscribe: ${unsubscribeUrl}`,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    });

    try {
      const ids = await sendBatch(items);
      await Promise.all(
        group.map((row, i) =>
          prisma.campaignRecipient.update({
            where: { id: row.id },
            data: {
              providerId: ids[i],
              status: "SENT",
              sentAt: new Date(),
            },
          })
        )
      );
      sent += group.length;
    } catch (err) {
      failed += group.length;
      await Promise.all(
        group.map((row) =>
          prisma.campaignRecipient.update({
            where: { id: row.id },
            data: {
              status: "FAILED",
              error: err instanceof Error ? err.message.slice(0, 300) : "send_failed",
            },
          })
        )
      );
    }
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: failed > 0 && sent === 0 ? "FAILED" : "SENT",
      sentAt: new Date(),
    },
  });

  return { ok: sent > 0, total: rows.length, sent, failed };
}

/**
 * Cron entrypoint: find every SCHEDULED campaign whose scheduledAt is now due
 * and send it. Safe to call repeatedly — sendCampaign flips status to SENDING
 * up front, so a second overlapping run skips already-claimed campaigns.
 */
export async function runDueScheduledCampaigns(): Promise<{
  processed: number;
  results: { id: string; outcome: SendOutcome }[];
}> {
  const due = await prisma.campaign.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    select: { id: true },
    orderBy: { scheduledAt: "asc" },
  });
  const results: { id: string; outcome: SendOutcome }[] = [];
  for (const c of due) {
    const outcome = await sendCampaign(c.id);
    results.push({ id: c.id, outcome });
  }
  return { processed: due.length, results };
}

export interface CampaignStat {
  total: number;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  failed: number;
  opened: number;
  clicked: number;
}

/** Aggregate per-recipient state into headline numbers for the dashboard. */
export async function loadCampaignStats(campaignId: string): Promise<CampaignStat> {
  const rows = await prisma.campaignRecipient.findMany({
    where: { campaignId },
    select: { status: true, deliveredAt: true, openCount: true, clickCount: true },
  });
  const stat: CampaignStat = {
    total: rows.length,
    sent: 0,
    delivered: 0,
    bounced: 0,
    complained: 0,
    failed: 0,
    opened: 0,
    clicked: 0,
  };
  for (const r of rows) {
    if (r.status !== "PENDING" && r.status !== "FAILED") stat.sent++;
    if (r.status === "FAILED") stat.failed++;
    if (r.status === "BOUNCED") stat.bounced++;
    if (r.status === "COMPLAINED") stat.complained++;
    if (r.deliveredAt) stat.delivered++;
    if (r.openCount > 0) stat.opened++;
    if (r.clickCount > 0) stat.clicked++;
  }
  return stat;
}

export async function loadAllCampaigns() {
  return prisma.campaign.findMany({ orderBy: [{ createdAt: "desc" }] });
}

/**
 * Send a single preview copy of a campaign to one address, without creating
 * recipient rows or touching campaign status. Uses an unsubscribe token that
 * isn't tied to a real recipient (the link still works defensively).
 */
export async function sendTest(
  campaign: Pick<Campaign, "subject" | "preheader" | "bodyHtml" | "fromName">,
  toEmail: string
): Promise<{ ok: boolean; error?: string }> {
  const base = appUrl();
  const unsubscribeUrl = `${base}/api/unsubscribe?token=preview-${newUnsubToken()}`;
  const html = renderCampaignEmail({
    subject: campaign.subject,
    preheader: campaign.preheader,
    bodyHtml: campaign.bodyHtml,
    unsubscribeUrl,
  });
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[campaign:dev] would send TEST to ${toEmail}`);
    return { ok: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromHeader(campaign.fromName),
      to: [toEmail],
      subject: `[TEST] ${campaign.subject}`,
      html,
      text: htmlToText(campaign.bodyHtml),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `resend_${res.status}: ${body.slice(0, 200)}` };
  }
  return { ok: true };
}
