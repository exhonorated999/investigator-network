import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Record a partner click, then redirect to the partner's destination URL.
 * Partner placements link here instead of directly to the sponsor so we can
 * report clicks-per-period back to sponsors (ROI). The redirect target is the
 * admin-set `partner.url`, never user input.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const partner = await prisma.partner.findUnique({
    where: { id },
    select: { url: true },
  });
  if (!partner || !partner.url) {
    return NextResponse.redirect(new URL("/partners", _req.url));
  }

  // Attribute to the signed-in user when available (never shown per-user to
  // sponsors — only used for aggregate reach later). Fire-and-forget so a
  // logging hiccup never blocks the redirect.
  try {
    const session = await auth();
    await prisma.partnerClick.create({
      data: { partnerId: id, userId: session?.user?.id ?? null },
    });
  } catch {
    // ignore — the click log is best-effort, the redirect is what matters
  }

  return NextResponse.redirect(partner.url);
}
