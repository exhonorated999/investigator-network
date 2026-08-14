/**
 * Admin waiting-item alert cron trigger.
 *
 * Intended to run on a schedule (Railway Cron service, e.g. every 15 minutes:
 * cron expression `*​/15 * * * *`). It POSTs to the app's protected endpoint
 * with the shared secret; all logic lives server-side in
 * src/app/api/cron/admin-alerts/route.ts.
 *
 * Required env (set on the cron service in Railway):
 *   CRON_SECRET  - must match the app's CRON_SECRET
 *   APP_URL      - public base URL, e.g. https://www.inv-network.org
 *
 * Exits non-zero on failure so the cron run is marked failed in Railway.
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

const endpoint = `${base}/api/cron/admin-alerts`;

try {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`cron: ${res.status} ${text}`);
    process.exit(1);
  }
  console.log(`cron: ok ${text}`);
} catch (err) {
  console.error("cron: request failed", err);
  process.exit(1);
}
