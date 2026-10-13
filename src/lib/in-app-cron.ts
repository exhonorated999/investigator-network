/**
 * In-app scheduler: every 5 minutes the running web server calls its own
 * protected /api/cron/* endpoints over localhost. Replaces the separate Railway
 * cron service (which never ran reliably). All jobs are idempotent and claim
 * work in the DB before sending, so overlapping ticks / multiple replicas are
 * safe.
 *
 * Enabled only on Railway (RAILWAY_* env present) unless IN_APP_CRON=on; set
 * IN_APP_CRON=off to disable. Never runs in local dev by default because the
 * dev DB is the shared production database.
 *
 * Prisma-free on purpose (loaded from instrumentation.ts).
 */

const JOBS = ["/api/cron/send-scheduled", "/api/cron/live-reminders", "/api/cron/admin-alerts"];
const INTERVAL_MS = 5 * 60 * 1000;
const FIRST_DELAY_MS = 60 * 1000;

declare global {
  // Survives module re-evaluation within one process.
  var __inAppCronStarted: boolean | undefined;
}

export function inAppCronEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = (env.IN_APP_CRON || "").toLowerCase();
  if (flag === "off" || flag === "0" || flag === "false") return false;
  if (flag === "on" || flag === "1" || flag === "true") return true;
  return Boolean(env.RAILWAY_PROJECT_ID || env.RAILWAY_ENVIRONMENT_NAME || env.RAILWAY_ENVIRONMENT);
}

let running = false;

/** One scheduler pass (exported for tests). Skips if a pass is in flight. */
export async function runCronTick(base: string, secret: string): Promise<void> {
  return tick(base, secret);
}

async function tick(base: string, secret: string) {
  if (running) return; // previous tick still in flight
  running = true;
  try {
    for (const path of JOBS) {
      try {
        const res = await fetch(`${base}${path}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(4 * 60 * 1000),
        });
        const text = await res.text();
        if (!res.ok) console.error(`[in-app-cron] ${path}: ${res.status} ${text.slice(0, 300)}`);
        else if (/"(totalSent|processed|msgSent|questionSent)":[1-9]/.test(text))
          console.log(`[in-app-cron] ${path}: ${text.slice(0, 300)}`);
      } catch (err) {
        console.error(`[in-app-cron] ${path}: failed`, err instanceof Error ? err.message : err);
      }
    }
  } finally {
    running = false;
  }
}

export function startInAppCron() {
  if (globalThis.__inAppCronStarted) return;
  if (!inAppCronEnabled()) return;
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[in-app-cron] CRON_SECRET not set — scheduler disabled");
    return;
  }
  globalThis.__inAppCronStarted = true;
  const base = `http://127.0.0.1:${process.env.PORT || 3000}`;
  console.log(`[in-app-cron] started (every ${INTERVAL_MS / 60000} min) -> ${base}`);
  const run = () => void tick(base, secret);
  setTimeout(run, FIRST_DELAY_MS).unref?.();
  setInterval(run, INTERVAL_MS).unref?.();
}
