import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { renderCampaignEmail, appUrl } from "@/lib/email-template";

/**
 * Admin-only rendered preview of a campaign — the full branded email exactly as
 * a recipient would see it (shell + body + compliant footer), with a sample
 * unsubscribe link. Embedded in an iframe on the campaign detail page.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return new NextResponse("Not found", { status: 404 });

  const html = renderCampaignEmail({
    subject: campaign.subject,
    preheader: campaign.preheader,
    bodyHtml: campaign.bodyHtml,
    unsubscribeUrl: `${appUrl()}/api/unsubscribe?token=preview`,
  });

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
