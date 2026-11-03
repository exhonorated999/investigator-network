import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TURNSTILE_FAILED_MESSAGE,
  TURNSTILE_MISSING_MESSAGE,
  turnstileMode,
  turnstileSiteKey,
  verifyTurnstileToken,
} from "./turnstile";

const KEYS = {
  TURNSTILE_SITE_KEY: "site-key",
  TURNSTILE_SECRET_KEY: "secret-key",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("turnstileMode", () => {
  it("verifies only when both keys are set", () => {
    assert.equal(turnstileMode({ ...KEYS, NODE_ENV: "production" }), "verify");
    assert.equal(turnstileMode({ ...KEYS, NODE_ENV: "development" }), "verify");
  });

  it("skips when a key is missing, including in production", () => {
    assert.equal(turnstileMode({ NODE_ENV: "development" }), "skip");
    assert.equal(turnstileMode({ NODE_ENV: "production" }), "skip");
    assert.equal(
      turnstileMode({ NODE_ENV: "production", TURNSTILE_SITE_KEY: "site-only" }),
      "skip"
    );
    assert.equal(
      turnstileMode({
        NODE_ENV: "production",
        TURNSTILE_SECRET_KEY: "secret-only",
      }),
      "skip"
    );
    assert.equal(turnstileSiteKey({ NODE_ENV: "production" }), null);
    assert.equal(
      turnstileSiteKey({ NODE_ENV: "production", TURNSTILE_SITE_KEY: "site" }),
      null
    );
  });

  it("returns the trimmed site key when verification is on", () => {
    assert.equal(
      turnstileSiteKey({
        NODE_ENV: "production",
        TURNSTILE_SITE_KEY: "  site-key  ",
        TURNSTILE_SECRET_KEY: "secret-key",
      }),
      "site-key"
    );
  });
});

describe("verifyTurnstileToken", () => {
  it("skips the network call when keys are missing in development", async () => {
    let called = false;
    const result = await verifyTurnstileToken("", null, {
      env: { NODE_ENV: "development" },
      fetchImpl: async () => {
        called = true;
        return jsonResponse({ success: true });
      },
    });
    assert.deepEqual(result, { ok: true, code: "skipped" });
    assert.equal(called, false);
  });

  it("skips the network call in production when keys are missing", async () => {
    let called = false;
    const result = await verifyTurnstileToken("token", "203.0.113.4", {
      env: { NODE_ENV: "production" },
      fetchImpl: async () => {
        called = true;
        return jsonResponse({ success: true });
      },
    });
    assert.deepEqual(result, { ok: true, code: "skipped" });
    assert.equal(called, false);
  });

  it("rejects a missing token when keys are configured", async () => {
    const result = await verifyTurnstileToken("  ", "203.0.113.4", {
      env: { ...KEYS, NODE_ENV: "production" },
      fetchImpl: async () => jsonResponse({ success: true }),
    });
    assert.deepEqual(result, { ok: false, code: "missing-token" });
  });

  it("accepts a Siteverify success and sends the secret, token, and IP", async () => {
    let received: { url: string; body: string } | null = null;
    const result = await verifyTurnstileToken("turnstile-token", "203.0.113.4", {
      env: { ...KEYS, NODE_ENV: "production" },
      fetchImpl: async (url, init) => {
        received = { url: String(url), body: String(init?.body ?? "") };
        return jsonResponse({ success: true });
      },
    });
    assert.deepEqual(result, { ok: true, code: "ok" });
    assert.ok(received);
    const sent = received as { url: string; body: string };
    assert.equal(
      sent.url,
      "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    );
    assert.deepEqual(JSON.parse(sent.body), {
      secret: "secret-key",
      response: "turnstile-token",
      remoteip: "203.0.113.4",
    });
  });

  it("omits an unknown IP", async () => {
    let body = "";
    await verifyTurnstileToken("turnstile-token", "unknown", {
      env: { ...KEYS, NODE_ENV: "production" },
      fetchImpl: async (_url, init) => {
        body = String(init?.body ?? "");
        return jsonResponse({ success: true });
      },
    });
    assert.deepEqual(JSON.parse(body), {
      secret: "secret-key",
      response: "turnstile-token",
    });
  });

  it("rejects a failed Siteverify payload", async () => {
    const result = await verifyTurnstileToken("turnstile-token", null, {
      env: { ...KEYS, NODE_ENV: "development" },
      fetchImpl: async () =>
        jsonResponse({ success: false, "error-codes": ["invalid-input-response"] }),
    });
    assert.deepEqual(result, { ok: false, code: "rejected" });
  });

  it("fails closed when Siteverify errors or the network throws", async () => {
    const http = await verifyTurnstileToken("turnstile-token", null, {
      env: { ...KEYS, NODE_ENV: "production" },
      fetchImpl: async () => jsonResponse({ success: false }, 500),
    });
    assert.deepEqual(http, { ok: false, code: "unreachable" });

    const thrown = await verifyTurnstileToken("turnstile-token", null, {
      env: { ...KEYS, NODE_ENV: "production" },
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });
    assert.deepEqual(thrown, { ok: false, code: "unreachable" });
  });
});

describe("turnstile messages", () => {
  it("does not include the secret or the key names", () => {
    for (const message of [TURNSTILE_FAILED_MESSAGE, TURNSTILE_MISSING_MESSAGE]) {
      assert.equal(/TURNSTILE|secret|siteverify/i.test(message), false);
    }
  });
});
