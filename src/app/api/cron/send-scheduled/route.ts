import { NextRequest, NextResponse } from "next/server";
import { runDueScheduledCampaigns } from "@/lib/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron endpoint that dispatches any SCHEDULED campaign whose time has arrived.
 * Trigger it on a schedule (e.g. every 5 minutes) from an external scheduler
 * such as a Railway cron service. Protected by a bearer secret so it can't be
 * poked by the public.
 *
 * Auth: send `Authorization: Bearer <CRON_SECRET>`, `x-cron-secret: <CRON_SECRET>`,
 * or `?key=<CRON_SECRET>` (matches the other /api/cron routes).
 * If CRON_SECRET is unset the endpoint refuses to run (fail closed).
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "cron_disabled" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  const header = req.headers.get("x-cron-secret") || "";
  const query = req.nextUrl.searchParams.get("key") || "";
  if (bearer !== secret && header !== secret && query !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const result = await runDueScheduledCampaigns();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
