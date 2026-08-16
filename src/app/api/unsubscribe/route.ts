import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/email-template";

/**
 * Unsubscribe endpoint. Each campaign email carries a per-recipient token in
 * both the footer link (GET) and the List-Unsubscribe header (POST one-click,
 * RFC 8058). Either path adds the address to the global Suppression list and
 * marks any matching contact UNSUBSCRIBED. Suppression blocks future campaigns
 * but never transactional mail.
 */

export const runtime = "nodejs";

async function unsubscribeByToken(token: string): Promise<string | null> {
  const rec = await prisma.campaignRecipient.findUnique({
    where: { unsubToken: token },
    select: { email: true },
  });
  if (!rec) return null;
  const email = rec.email.trim().toLowerCase();

  await prisma.suppression.upsert({
    where: { email },
    create: { email, reason: "UNSUBSCRIBE" },
    update: { reason: "UNSUBSCRIBE" },
  });
  await prisma.contact
    .updateMany({ where: { email }, data: { status: "UNSUBSCRIBED" } })
    .catch(() => {});
  return email;
}

function page(title: string, message: string): NextResponse {
  const base = appUrl();
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title></head>
<body style="margin:0;background:#0d0f14;color:#e0e8f0;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:520px;margin:12vh auto;padding:32px;background:#141720;border:1px solid #1e2b38;border-radius:12px;text-align:center;">
<div style="height:4px;background:#00b4d8;border-radius:4px;margin:-32px -32px 24px;"></div>
<h1 style="font-size:20px;margin:0 0 12px;">${title}</h1>
<p style="color:#8899aa;font-size:15px;line-height:1.6;margin:0 0 20px;">${message}</p>
<a href="${base}" style="color:#90e0ef;text-decoration:none;font-size:13px;">Return to Investigator Network</a>
</div></body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!token) return page("Invalid link", "This unsubscribe link is missing its token.");
  const email = await unsubscribeByToken(token);
  if (!email) {
    return page("Link not recognized", "We couldn't match this unsubscribe link. You may already be unsubscribed.");
  }
  return page(
    "You're unsubscribed",
    `${email} has been removed from our email campaigns. You won't receive further newsletters or announcements.`
  );
}

/** One-click unsubscribe (List-Unsubscribe-Post). Mail clients POST here. */
export async function POST(req: Request) {
  const url = new URL(req.url);
  let token = url.searchParams.get("token") || "";
  if (!token) {
    // Some clients send the token in the form body instead of the query.
    const body = await req.text().catch(() => "");
    const m = /token=([^&\s]+)/.exec(body);
    if (m) token = decodeURIComponent(m[1]);
  }
  if (!token) return new NextResponse("Missing token", { status: 400 });
  await unsubscribeByToken(token);
  // One-click spec expects a 2xx with no required body.
  return NextResponse.json({ ok: true });
}
