import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { briefDbError, isTransientDbError } from "@/lib/db-errors";
import { prisma } from "@/lib/prisma";

/** Ask Svix to wait this long before retrying a transient database failure. */
const RETRY_AFTER_SECONDS = "5";

/**
 * Resend webhook receiver — records delivery + engagement events onto
 * CampaignRecipient rows and maintains the global Suppression list.
 *
 * Security: Resend signs webhooks with Svix. We verify the signature over the
 * RAW request body using RESEND_WEBHOOK_SECRET (a `whsec_...` value). Requests
 * that fail verification are rejected with 401. If the secret is unset (local
 * dev), verification is skipped so events can be simulated.
 *
 * Events we handle (data.email_id maps to CampaignRecipient.providerId):
 *   email.delivered / email.bounced / email.complained / email.opened /
 *   email.clicked. Transactional emails share this endpoint but have no
 *   matching recipient row, so they're ignored harmlessly (HTTP 200).
 *
 * Status writes and the suppression upsert are idempotent, so a Svix retry
 * of the same event is safe. Open/click counters still increment once per
 * delivered attempt; the first-seen timestamp is written before the counter
 * so a retry whose increment never committed does not skip it.
 *
 * A transient database error returns 503 with Retry-After instead of an
 * uncaught 500. Svix retries those. Unknown events are acked.
 */

export const runtime = "nodejs";

interface ResendEvent {
  type?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
  };
}

/** Verify a Svix signature. Returns true when valid (or when no secret set). */
function verifySvix(
  secret: string | undefined,
  headers: Headers,
  rawBody: string
): boolean {
  if (!secret) return true; // dev: allow unsigned
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!id || !timestamp || !sigHeader) return false;

  // Secret is "whsec_<base64>"; the key is the base64 portion decoded.
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signed = `${id}.${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", key).update(signed).digest("base64");

  // Header is space-separated "v1,<sig>" entries; any match passes.
  for (const part of sigHeader.split(" ")) {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    try {
      const a = Buffer.from(sig, "base64");
      const b = Buffer.from(expected, "base64");
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch {
      // ignore malformed entry
    }
  }
  return false;
}

async function suppress(email: string, reason: "BOUNCE" | "COMPLAINT") {
  const key = email.trim().toLowerCase();
  if (!key) return;
  await prisma.suppression.upsert({
    where: { email: key },
    create: { email: key, reason },
    update: { reason },
  });
  // Reflect the state on any matching contact.
  await prisma.contact
    .updateMany({
      where: { email: key },
      data: { status: reason === "BOUNCE" ? "BOUNCED" : "COMPLAINED" },
    })
    .catch(() => {});
}

export async function POST(req: Request) {
  const raw = await req.text();

  if (!verifySvix(process.env.RESEND_WEBHOOK_SECRET, req.headers, raw)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(raw) as ResendEvent;
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }

  const type = event.type ?? "";
  const providerId = event.data?.email_id;
  if (!providerId) return NextResponse.json({ ok: true, ignored: "no_id" });

  try {
    const ignored = await recordCampaignEvent(type, providerId);
    if (ignored) return NextResponse.json({ ok: true, ignored });
  } catch (err) {
    const detail = briefDbError(err);
    const label = type || "unknown";
    if (isTransientDbError(err)) {
      console.error(
        `resend webhook: transient database error for ${label} (${detail})`
      );
      return NextResponse.json(
        { ok: false, error: "database_unavailable" },
        { status: 503, headers: { "Retry-After": RETRY_AFTER_SECONDS } }
      );
    }
    console.error(`resend webhook: failed for ${label} (${detail})`);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Apply one verified event. Throws on database failure so the caller can
 * return 503 and let Svix retry. No matching recipient is an ack, not an error.
 */
async function recordCampaignEvent(
  type: string,
  providerId: string
): Promise<"no_recipient" | null> {
  const recipient = await prisma.campaignRecipient.findFirst({
    where: { providerId },
    select: { id: true, email: true, status: true },
  });
  // Not a campaign message (e.g. transactional) — ack and ignore.
  if (!recipient) return "no_recipient";

  const now = new Date();

  switch (type) {
    case "email.delivered":
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          deliveredAt: now,
          // Don't downgrade a terminal bounce/complaint.
          ...(recipient.status === "SENT" ? { status: "DELIVERED" } : {}),
        },
      });
      break;

    case "email.bounced":
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "BOUNCED", bouncedAt: now },
      });
      await suppress(recipient.email, "BOUNCE");
      break;

    case "email.complained":
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "COMPLAINED", complainedAt: now },
      });
      await suppress(recipient.email, "COMPLAINT");
      break;

    case "email.opened":
      // Timestamp first: it only fills a null column, so a retry is a no-op.
      // The counter comes second. If it fails, Svix retries and increments once.
      await prisma.campaignRecipient.updateMany({
        where: { id: recipient.id, firstOpenedAt: null },
        data: { firstOpenedAt: now },
      });
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          openCount: { increment: 1 },
          lastOpenedAt: now,
        },
      });
      break;

    case "email.clicked":
      await prisma.campaignRecipient.updateMany({
        where: { id: recipient.id, firstClickedAt: null },
        data: { firstClickedAt: now },
      });
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          clickCount: { increment: 1 },
          lastClickedAt: now,
        },
      });
      break;

    default:
      // sent / delivery_delayed / others — ack without change.
      break;
  }

  return null;
}
