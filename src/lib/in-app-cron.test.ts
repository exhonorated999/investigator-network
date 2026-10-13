import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { inAppCronEnabled, runCronTick } from "./in-app-cron";

test("inAppCronEnabled: Railway on, local off, explicit flag wins", () => {
  assert.equal(inAppCronEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(inAppCronEnabled({ RAILWAY_PROJECT_ID: "x" } as unknown as NodeJS.ProcessEnv), true);
  assert.equal(inAppCronEnabled({ RAILWAY_PROJECT_ID: "x", IN_APP_CRON: "off" } as unknown as NodeJS.ProcessEnv), false);
  assert.equal(inAppCronEnabled({ IN_APP_CRON: "on" } as unknown as NodeJS.ProcessEnv), true);
});

test("runCronTick POSTs every job with the bearer secret, survives failures, no overlap", async () => {
  const hits: string[] = [];
  const server = createServer((req, res) => {
    hits.push(`${req.method} ${req.url} ${req.headers.authorization}`);
    setTimeout(() => {
      res.statusCode = req.url === "/api/cron/live-reminders" ? 500 : 200;
      res.end("{}");
    }, 30);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const origErr = console.error;
  console.error = () => {};
  try {
    await Promise.all([runCronTick(base, "s3"), runCronTick(base, "s3")]); // 2nd must no-op
  } finally {
    console.error = origErr;
    server.close();
  }
  assert.deepEqual(hits, [
    "POST /api/cron/send-scheduled Bearer s3",
    "POST /api/cron/live-reminders Bearer s3",
    "POST /api/cron/admin-alerts Bearer s3",
  ]);
});
