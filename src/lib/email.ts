/**
 * Transactional email helper (server-only).
 *
 * Delivery is via Resend (https://resend.com). We call the REST API directly
 * with `fetch` so there is no extra runtime dependency to keep in sync.
 *
 * Degrades gracefully: if `RESEND_API_KEY` is not set (e.g. local dev), emails
 * are logged to the server console instead of being sent, so flows keep working
 * without external credentials.
 *
 * Required env for real delivery:
 *   RESEND_API_KEY   - Resend API key
 *   EMAIL_FROM       - verified sender, e.g. "Investigator Network <justin@intellect-le.com>"
 *   AUTH_URL         - public base URL, used to build the sign-in link
 *
 * NOTE: this module is server-only. Never import it (or any value from it) into
 * a "use client" component — it must never reach the browser bundle.
 */

import { parseSessionInstant, formatPacific } from "@/lib/session-time";

const FROM = process.env.EMAIL_FROM || "Investigator Network <justin@intellect-le.com>";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  skipped?: boolean;
  error?: string;
}

async function send(mail: Mail): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Dev fallback — do not throw, just log so flows keep working.
    console.log(
      `[email:dev] would send to ${mail.to} from ${FROM}\n  subject: ${mail.subject}\n  ${mail.text}`
    );
    return { ok: true, skipped: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        ...(mail.html ? { html: mail.html } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] Resend error ${res.status}: ${body}`);
      return { ok: false, error: `resend_${res.status}` };
    }

    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: json.id };
  } catch (err) {
    console.error("[email] Resend request failed:", err);
    return { ok: false, error: "request_failed" };
  }
}

export function sendApprovalEmail(to: string, name: string) {
  return send({
    to,
    subject: "Your Investigator Network access is approved",
    text: `Hi ${name},\n\nYour access to the Investigator Network training platform has been approved. You can now sign in and begin your training.\n\nSign in: ${loginUrl()}\n\n— Investigator Network`,
  });
}

export function sendDenialEmail(to: string, name: string) {
  return send({
    to,
    subject: "Update on your Investigator Network access request",
    text: `Hi ${name},\n\nAfter review, your access request was not approved at this time. If you believe this is in error, please contact an administrator.\n\n— Investigator Network`,
  });
}

export function sendLiveSessionReminder(
  to: string,
  name: string,
  opts: { courseTitle: string; unitTitle: string; startsAt?: string; joinUrl?: string }
) {
  const when = opts.startsAt ? formatSessionTime(opts.startsAt) : "the scheduled time";
  const join = opts.joinUrl
    ? `\n\nWhen it's time, join the Teams meeting here: ${opts.joinUrl}`
    : "";
  return send({
    to,
    subject: `Reminder: live training "${opts.unitTitle}" — ${opts.courseTitle}`,
    text:
      `Hi ${name},\n\n` +
      `This is a reminder for your upcoming live training session "${opts.unitTitle}" ` +
      `in ${opts.courseTitle}, scheduled for ${when}.\n\n` +
      `Please log in to Investigator Network at least 15 minutes prior to the start time so you're ready when the session begins:\n${loginUrl()}` +
      `${join}\n\n— Investigator Network`,
  });
}

/**
 * Alert an admin that a direct message has been sitting unread for a while
 * (the cron only fires this once it has been waiting past the threshold).
 */
export function sendAdminMessageAlert(
  to: string,
  adminName: string,
  opts: { fromName: string; preview: string; waitingSince: Date }
) {
  const when = formatPacific(opts.waitingSince);
  const preview = opts.preview.trim().slice(0, 200);
  return send({
    to,
    subject: `Waiting message from ${opts.fromName} — Investigator Network`,
    text:
      `Hi ${adminName},\n\n` +
      `You have an unread direct message from ${opts.fromName} that has been ` +
      `waiting since ${when}.\n\n` +
      (preview ? `Message:\n"${preview}"\n\n` : "") +
      `Open your inbox to reply:\n${appUrl()}/messages\n\n` +
      `— Investigator Network`,
  });
}

/**
 * Alert an admin that a course question has gone unanswered by staff past the
 * threshold, so it can be picked up from the admin dashboard queue.
 */
export function sendAdminQuestionAlert(
  to: string,
  adminName: string,
  opts: { courseTitle: string; askedBy: string; preview: string; waitingSince: Date }
) {
  const when = formatPacific(opts.waitingSince);
  const preview = opts.preview.trim().slice(0, 200);
  return send({
    to,
    subject: `Unanswered course question — ${opts.courseTitle}`,
    text:
      `Hi ${adminName},\n\n` +
      `A course question in "${opts.courseTitle}" from ${opts.askedBy} has been ` +
      `waiting for a staff answer since ${when}.\n\n` +
      (preview ? `Question:\n"${preview}"\n\n` : "") +
      `Answer it from your dashboard queue:\n${appUrl()}/dashboard\n\n` +
      `— Investigator Network`,
  });
}

/**
 * Format a session start time for display in Pacific, resolving naive
 * wall-clock timestamps via the shared session-time parser.
 */
function formatSessionTime(raw: string): string {
  const d = parseSessionInstant(raw);
  return d ? formatPacific(d) : "the scheduled time";
}

function loginUrl() {
  return appUrl() + "/login";
}

function appUrl() {
  return (process.env.APP_URL || process.env.AUTH_URL || "http://localhost:3000").replace(
    /\/+$/,
    ""
  );
}
