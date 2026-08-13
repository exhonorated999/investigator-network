import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendLiveSessionReminder } from "@/lib/email";
import { parseSessionInstant, pacificTimeOnDay } from "@/lib/session-time";

/**
 * Automatic live-training reminder job.
 *
 * Runs on a schedule (Railway cron, every ~5 min). For a small whitelist of
 * Datapilot courses, it finds upcoming LIVE_SESSION units and, on the day
 * BEFORE each session at ~9am Pacific, emails a reminder to the learners who
 * enrolled SINCE the previous session (i.e. new attendees who haven't been
 * through a live class yet). Returning learners are intentionally skipped so
 * they aren't pestered every week/month.
 *
 * Idempotent: every send is recorded in EmailLog (kind="live_reminder",
 * unitId, userId), so repeated cron ticks never double-email.
 *
 * Security: requires the CRON_SECRET, supplied either as
 *   Authorization: Bearer <secret>   or   x-cron-secret: <secret>
 *
 * Debug query params (only honored when the secret is valid):
 *   ?dryRun=1   -> compute + report recipients but do NOT send or log
 *   ?now=<ISO>  -> override "now" for testing the send window
 *
 * This must run on the Node runtime (Prisma) and never be cached.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REMINDER_KIND = "live_reminder";

// Courses that participate in automatic reminders. Other Datapilot courses
// (Scout, Meta Quest, etc.) are intentionally excluded.
const COURSE_SLUGS = [
  "datapilot-dpx-dp10-essentials",
  "datapilot-desktop-essentials",
  "advanced-datapilot",
];

// How early, before the session start, the "day before at 9am Pacific" gate
// opens. Once `now` is past the gate (and before the session), eligible new
// enrollees are reminded on the next tick.
function sendGateFor(sessionInstant: Date): Date {
  // A moment safely on the Pacific day before the session (sessions run 8-11am
  // Pacific, so −24h lands on the prior Pacific calendar day), then 9:00am PT.
  const dayBefore = new Date(sessionInstant.getTime() - 24 * 60 * 60 * 1000);
  return pacificTimeOnDay(dayBefore, 9, 0);
}

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

interface UnitResult {
  unitId: string;
  courseSlug: string;
  unitTitle: string;
  startsAt: string | null;
  gateOpen: boolean;
  eligible: number;
  sent: number;
  skippedAlready: number;
  recipients?: string[];
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

  // Pull every LIVE_SESSION unit in the whitelisted courses, with its course
  // and all live-session sibling dates (to compute "previous session").
  const units = await prisma.unit.findMany({
    where: {
      type: "LIVE_SESSION",
      section: { course: { slug: { in: COURSE_SLUGS } } },
    },
    select: {
      id: true,
      title: true,
      data: true,
      section: {
        select: { courseId: true, course: { select: { slug: true, title: true } } },
      },
    },
  });

  // Group session instants per course to find each session's predecessor.
  const courseSessions = new Map<string, Date[]>();
  for (const u of units) {
    const inst = parseSessionInstant((u.data as { startsAt?: unknown })?.startsAt);
    if (!inst) continue;
    const arr = courseSessions.get(u.section.courseId) ?? [];
    arr.push(inst);
    courseSessions.set(u.section.courseId, arr);
  }
  for (const arr of courseSessions.values()) arr.sort((a, b) => a.getTime() - b.getTime());

  const results: UnitResult[] = [];
  let totalSent = 0;

  for (const u of units) {
    const courseSlug = u.section.course.slug;
    const rawStarts = (u.data as { startsAt?: unknown })?.startsAt;
    const sessionInstant = parseSessionInstant(rawStarts);
    const base: UnitResult = {
      unitId: u.id,
      courseSlug,
      unitTitle: u.title,
      startsAt: typeof rawStarts === "string" ? rawStarts : null,
      gateOpen: false,
      eligible: 0,
      sent: 0,
      skippedAlready: 0,
    };

    if (!sessionInstant) {
      results.push(base);
      continue;
    }

    // Only future sessions, and only once the day-before-9am gate has opened.
    const gate = sendGateFor(sessionInstant);
    const gateOpen = now >= gate && now < sessionInstant;
    base.gateOpen = gateOpen;
    if (!gateOpen) {
      results.push(base);
      continue;
    }

    // Previous session for this course = latest session strictly before this one.
    const siblings = courseSessions.get(u.section.courseId) ?? [];
    let prev: Date | null = null;
    for (const s of siblings) {
      if (s.getTime() < sessionInstant.getTime() && (!prev || s > prev)) prev = s;
    }

    // New enrollees = APPROVED learners who enrolled after the previous session
    // (or everyone, if there is no previous session).
    const enrollments = await prisma.enrollment.findMany({
      where: {
        courseId: u.section.courseId,
        ...(prev ? { enrolledAt: { gt: prev } } : {}),
        user: { status: "APPROVED" },
      },
      select: { user: { select: { id: true, name: true, email: true } } },
    });

    // Drop anyone already reminded for this unit.
    const already = await prisma.emailLog.findMany({
      where: { kind: REMINDER_KIND, unitId: u.id },
      select: { userId: true },
    });
    const alreadySet = new Set(already.map((a) => a.userId));

    const targets = enrollments
      .map((e) => e.user)
      .filter((usr) => !alreadySet.has(usr.id) && usr.email);

    base.eligible = enrollments.length;
    base.skippedAlready = enrollments.filter((e) => alreadySet.has(e.user.id)).length;

    if (dryRun) {
      base.recipients = targets.map((t) => t.email);
      results.push(base);
      continue;
    }

    const data = (u.data as Record<string, unknown>) ?? {};
    for (const usr of targets) {
      const res = await sendLiveSessionReminder(usr.email, usr.name, {
        courseTitle: u.section.course.title,
        unitTitle: u.title,
        startsAt: typeof rawStarts === "string" ? rawStarts : undefined,
        joinUrl: data.teamsJoinUrl ? String(data.teamsJoinUrl) : undefined,
      });
      if (res.ok) {
        // Record even for the dev/no-key "skipped" case so behavior is
        // consistent — a successful no-op still means "handled". Tolerate a
        // unique-constraint race (overlapping cron ticks) by treating a
        // duplicate as already-sent instead of aborting the batch.
        try {
          await prisma.emailLog.create({
            data: {
              kind: REMINDER_KIND,
              unitId: u.id,
              userId: usr.id,
              email: usr.email,
            },
          });
          base.sent += 1;
          totalSent += 1;
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code === "P2002") {
            base.skippedAlready += 1;
          } else {
            throw err;
          }
        }
      }
    }

    results.push(base);
  }

  return NextResponse.json({
    ok: true,
    now: now.toISOString(),
    dryRun,
    totalSent,
    units: results,
  });
}
