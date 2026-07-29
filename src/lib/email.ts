/**
 * Minimal transactional email helper.
 *
 * v1 is provider-agnostic and degrades gracefully: if SMTP env vars are not
 * configured (e.g. local dev), emails are logged to the server console instead
 * of being sent, so the approval flow works without external credentials.
 *
 * To enable real delivery, set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS and
 * EMAIL_FROM, then wire a transport (e.g. nodemailer) in `send()`.
 */

const FROM = process.env.EMAIL_FROM || "no-reply@investigator-network.com";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

async function send(mail: Mail): Promise<void> {
  const configured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );

  if (!configured) {
    // Dev fallback — do not throw, just log so flows keep working.
    console.log(
      `[email:dev] would send to ${mail.to} from ${FROM}\n  subject: ${mail.subject}\n  ${mail.text}`
    );
    return;
  }

  // TODO(prod): integrate nodemailer / Resend here using the SMTP_* env vars.
  console.log(`[email] sending to ${mail.to}: ${mail.subject}`);
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
  const when = opts.startsAt
    ? new Date(opts.startsAt).toLocaleString()
    : "the scheduled time";
  const join = opts.joinUrl ? `\n\nJoin the Teams meeting: ${opts.joinUrl}` : "";
  return send({
    to,
    subject: `Reminder: live session "${opts.unitTitle}" — ${opts.courseTitle}`,
    text: `Hi ${name},\n\nThis is a reminder for the upcoming live training session "${opts.unitTitle}" in ${opts.courseTitle}, scheduled for ${when}.${join}\n\n— Investigator Network`,
  });
}

function loginUrl() {
  return (process.env.AUTH_URL || "http://localhost:3000") + "/login";
}
