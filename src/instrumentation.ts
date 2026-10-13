/**
 * Next.js instrumentation hook — runs once per server start. Used to boot the
 * in-app 5-minute scheduler (scheduled campaigns, live-training reminders,
 * admin alerts). Node runtime only.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startInAppCron } = await import("./lib/in-app-cron");
  startInAppCron();
}
