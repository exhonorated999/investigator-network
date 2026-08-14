import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminMessageAlert, sendAdminQuestionAlert } from "@/lib/email";
import {
  loadAlertAdmins,
  findWaitingMessages,
  findWaitingQuestions,
} from "@/lib/admin-alerts";

/**
 * Admin waiting-item alerts.
 *
 * Runs on a schedule (Railway cron, e.g. every ~15 min). Emails admins about:
 *  - direct messages that have sat unread past the 4h threshold (recipient
 *    admin only — DMs are private), and
 *  - course questions with no staff answer past the same threshold (all
 *    approved admins — it's a shared queue).
 *
 * Idempotent: every send is recorded in EmailLog so repeated ticks never
 * double-email. Dedup keys:
 *   kind="admin_msg_alert",      unitId=<messageId>,  userId=<adminId>
 *   kind="admin_question_alert", unitId=<questionId>, userId=<adminId>
 *
 * Security: requires CRON_SECRET, supplied either as
 *   Authorization: Bearer <secret>   or   x-cron-secret: <secret>
 *
 * Debug query params (only honored when the secret is valid):
 *   ?dryRun=1   -> compute + report recipients but do NOT send or log
 *   ?now=<ISO>  -> override "now" for testing the threshold window
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KIND_MSG = "admin_msg_alert";
const KIND_QUESTION = "admin_question_alert";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  const header = request.headers.get("x-cron-secret") || "";
  return bearer === secret || header === secret;
}

/** Record a send; tolerate the overlapping-tick unique race as "already sent". */
async function logSent(kind: string, unitId: string, userId: string, email: string) {
  try {
    await prisma.emailLog.create({ data: { kind, unitId, userId, email } });
    return true;
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") return false;
    throw err;
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const nowParam = url.searchParams.get("now");
  const now = nowParam ? new Date(nowParam) : new Date();
  if (Number.isNaN(now.getTime())) {
    return NextResponse.json({ error: "bad now param" }, { status: 400 });
  }

  const admins = await loadAlertAdmins();
  const adminIds = admins.map((a) => a.id);
  const adminById = new Map(admins.map((a) => [a.id, a]));

  const [waitingMessages, waitingQuestions] = await Promise.all([
    findWaitingMessages(adminIds, now),
    findWaitingQuestions(now),
  ]);

  // Which (kind,unitId,userId) triples were already alerted?
  const already = await prisma.emailLog.findMany({
    where: { kind: { in: [KIND_MSG, KIND_QUESTION] } },
    select: { kind: true, unitId: true, userId: true },
  });
  const sentKey = new Set(already.map((a) => `${a.kind}:${a.unitId}:${a.userId}`));

  let msgSent = 0;
  let questionSent = 0;
  const recipients: string[] = [];

  // Direct messages — recipient admin only.
  for (const m of waitingMessages) {
    const key = `${KIND_MSG}:${m.messageId}:${m.adminId}`;
    if (sentKey.has(key)) continue;
    if (dryRun) {
      recipients.push(`msg:${m.adminEmail}`);
      continue;
    }
    const res = await sendAdminMessageAlert(m.adminEmail, m.adminName, {
      fromName: m.fromName,
      preview: m.preview,
      waitingSince: m.waitingSince,
    });
    if (res.ok && (await logSent(KIND_MSG, m.messageId, m.adminId, m.adminEmail))) {
      msgSent += 1;
    }
  }

  // Course questions — every approved admin.
  for (const q of waitingQuestions) {
    for (const admin of admins) {
      const key = `${KIND_QUESTION}:${q.questionId}:${admin.id}`;
      if (sentKey.has(key)) continue;
      if (dryRun) {
        recipients.push(`q:${admin.email}`);
        continue;
      }
      const a = adminById.get(admin.id)!;
      const res = await sendAdminQuestionAlert(a.email, a.name, {
        courseTitle: q.courseTitle,
        askedBy: q.askedBy,
        preview: q.preview,
        waitingSince: q.waitingSince,
      });
      if (res.ok && (await logSent(KIND_QUESTION, q.questionId, admin.id, a.email))) {
        questionSent += 1;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    now: now.toISOString(),
    dryRun,
    admins: admins.length,
    waitingMessages: waitingMessages.length,
    waitingQuestions: waitingQuestions.length,
    msgSent,
    questionSent,
    ...(dryRun ? { recipients } : {}),
  });
}
