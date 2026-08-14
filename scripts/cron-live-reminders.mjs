/**
 * Scheduled cron trigger (Railway Cron service, e.g. every 5 minutes:
 * cron expression `*​/5 * * * *`).
 *
 * Fires TWO protected jobs in sequence, each POSTing to the app with the shared
 * secret (all logic lives server-side):
 *   1. /api/cron/live-reminders  — live-training reminder emails
 *   2. /api/cron/admin-alerts    — admin "waiting >4h" message/question alerts
 *
 * Both jobs are idempotent server-side (EmailLog dedupe), so running them on
 * the same short interval is safe. The admin-alerts 4h threshold means a 5-min
 * tick just re-checks cheaply — nothing double-sends.
 *
 * Required env (set on the cron service in Railway):
 *   CRON_SECRET  - must match the app's CRON_SECRET
 *   APP_URL      - public base URL, e.g. https://www.inv-network.org
 *
 * Exits non-zero if EITHER job fails, so the cron run is marked failed in
 * Railway. Both jobs always attempt regardless of the other's outcome.
 */

const base = (process.env.APP_URL || process.env.AUTH_URL || "").replace(/\/+$/, "");
const secret = process.env.CRON_SECRET;

if (!base) {
  console.error("cron: APP_URL (or AUTH_URL) is not set");
  process.exit(1);
}
if (!secret) {
  console.error("cron: CRON_SECRET is not set");
  process.exit(1);
}

/** POST to one cron endpoint; returns true on success, false on any failure. */
async function trigger(path) {
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`cron ${path}: ${res.status} ${text}`);
      return false;
    }
    console.log(`cron ${path}: ok ${text}`);
    return true;
  } catch (err) {
    console.error(`cron ${path}: request failed`, err);
    return false;
  }
}

// Run both jobs; don't let one short-circuit the other.
const okReminders = await trigger("/api/cron/live-reminders");
const okAlerts = await trigger("/api/cron/admin-alerts");

if (!okReminders || !okAlerts) process.exit(1);
