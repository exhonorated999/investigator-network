/**
 * Admin "waiting item" alerts — the query side.
 *
 * Two kinds of inbound work can sit unattended: a direct message sent to an
 * admin, and a course question with no staff answer. This module finds items
 * that have been waiting longer than {@link ALERT_AFTER_MS} so the cron can
 * email the responsible admins. All send/idempotency lives in the route; this
 * file is pure reads.
 *
 * Design:
 * - A direct message is private to its two participants, so a waiting message
 *   alerts ONLY the admin who is the recipient — never every admin (that would
 *   leak private DMs). Dedup key is the message id, so a later reply in the
 *   same thread can alert again after it too crosses the threshold.
 * - A course question is a shared staff queue, so it alerts EVERY approved
 *   admin. Dedup key is the question id (alert each admin at most once per
 *   question).
 */
import { prisma } from "@/lib/prisma";

/** How long an item must sit before it's considered "waiting". */
export const ALERT_AFTER_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface WaitingMessage {
  /** Recipient admin (the one who hasn't read it). */
  adminId: string;
  adminName: string;
  adminEmail: string;
  /** Stable dedup id — the specific message that is waiting. */
  messageId: string;
  fromName: string;
  preview: string;
  waitingSince: Date;
}

export interface WaitingQuestion {
  questionId: string;
  courseTitle: string;
  askedBy: string;
  preview: string;
  waitingSince: Date;
}

/** Approved admins with a usable email — the alert audience. */
export async function loadAlertAdmins() {
  return prisma.user.findMany({
    where: { role: "ADMIN", status: "APPROVED", email: { not: "" } },
    select: { id: true, name: true, email: true },
  });
}

/**
 * Direct messages waiting past the threshold, one row per (recipient admin,
 * waiting message). A message qualifies when: an admin participates, the last
 * message in the thread was sent by the OTHER person, the admin has not read it
 * (createdAt > their lastReadAt), and it landed before the cutoff.
 */
export async function findWaitingMessages(
  adminIds: string[],
  now: Date = new Date()
): Promise<WaitingMessage[]> {
  if (adminIds.length === 0) return [];
  const cutoff = new Date(now.getTime() - ALERT_AFTER_MS);
  const adminSet = new Set(adminIds);

  // Only threads whose last activity is already older than the cutoff can hold
  // a waiting message (updatedAt bumps on every new message).
  const convos = await prisma.conversation.findMany({
    where: {
      updatedAt: { lt: cutoff },
      participants: { some: { userId: { in: adminIds } } },
    },
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const out: WaitingMessage[] = [];
  for (const c of convos) {
    const last = c.messages[0];
    if (!last) continue;
    if (last.createdAt >= cutoff) continue; // fresh — not yet waiting

    for (const p of c.participants) {
      if (!adminSet.has(p.userId)) continue; // only alert admin participants
      if (last.senderId === p.userId) continue; // admin sent it — nothing waiting
      if (last.createdAt <= p.lastReadAt) continue; // admin already read it

      const sender = c.participants.find((x) => x.userId === last.senderId);
      out.push({
        adminId: p.userId,
        adminName: p.user.name,
        adminEmail: p.user.email,
        messageId: last.id,
        fromName: sender?.user.name ?? "a member",
        preview: last.body,
        waitingSince: last.createdAt,
      });
    }
  }
  return out;
}

/**
 * Course questions with no staff answer, older than the cutoff. One row per
 * question; the caller fans each out to every admin.
 */
export async function findWaitingQuestions(
  now: Date = new Date()
): Promise<WaitingQuestion[]> {
  const cutoff = new Date(now.getTime() - ALERT_AFTER_MS);
  const questions = await prisma.courseQuestion.findMany({
    where: {
      resolved: false,
      createdAt: { lt: cutoff },
      // No staff answer yet.
      answers: { none: { staff: true } },
    },
    orderBy: { createdAt: "asc" },
    include: {
      course: { select: { title: true } },
      author: { select: { name: true } },
    },
  });

  return questions.map((q) => ({
    questionId: q.id,
    courseTitle: q.course.title,
    askedBy: q.author.name,
    preview: q.body,
    waitingSince: q.createdAt,
  }));
}
