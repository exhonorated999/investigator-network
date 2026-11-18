import { briefDbError, isTransientDbError } from "@/lib/db-errors";
import { prisma } from "@/lib/prisma";

/**
 * Database half of an unsubscribe. Suppression is what actually stops a
 * future campaign. The matching Contact row is marked UNSUBSCRIBED so the
 * admin list agrees. User accounts are left alone, and transactional mail
 * never reads this list.
 */

export async function findCampaignEmail(token: string): Promise<string | null> {
  const rec = await prisma.campaignRecipient.findUnique({
    where: { unsubToken: token },
    select: { email: true },
  });
  if (!rec) return null;
  return rec.email.trim().toLowerCase();
}

export async function suppressEmail(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  await prisma.suppression.upsert({
    where: { email: normalized },
    create: { email: normalized, reason: "UNSUBSCRIBE" },
    update: { reason: "UNSUBSCRIBE" },
  });
  try {
    await prisma.contact.updateMany({
      where: { email: normalized },
      data: { status: "UNSUBSCRIBED" },
    });
  } catch (err) {
    // A transient failure must propagate so the opt-out stays queued and the
    // contact row is retried. Any other contact error is logged; suppression
    // already blocks the next campaign.
    if (isTransientDbError(err)) throw err;
    console.error(
      JSON.stringify({
        event: "unsubscribe",
        phase: "result",
        outcome: "contact_update_failed",
        email: normalized,
        error: briefDbError(err),
      })
    );
  }
}
