import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  AUTH_LIMITS,
  AUTH_RATE_LIMIT_MESSAGE,
  clientIpFromHeaders,
  consumeAuthLimit,
  consumeRateLimit,
  resetRateLimits,
  withRateLimitScope,
} from "./rate-limit";

function headers(init: Record<string, string>): { get(name: string): string | null } {
  const bag = new Headers(init);
  return { get: (name) => bag.get(name) };
}

describe("consumeRateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows the configured number of hits, then blocks until the window passes", () => {
    const rule = { limit: 3, windowMs: 1_000 };
    const start = 1_000_000;
    assert.equal(consumeRateLimit("ip", rule, start).ok, true);
    assert.equal(consumeRateLimit("ip", rule, start + 1).ok, true);
    assert.equal(consumeRateLimit("ip", rule, start + 2).ok, true);
    const blocked = consumeRateLimit("ip", rule, start + 3);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.ok(blocked.retryAfterMs > 0);

    const after = consumeRateLimit("ip", rule, start + 1_000);
    assert.equal(after.ok, true);
  });

  it("keeps keys and windows independent", () => {
    const rule = { limit: 1, windowMs: 1_000 };
    assert.equal(consumeRateLimit("a", rule, 0).ok, true);
    assert.equal(consumeRateLimit("a", rule, 1).ok, false);
    assert.equal(consumeRateLimit("b", rule, 1).ok, true);
  });
});

describe("consumeAuthLimit", () => {
  beforeEach(() => resetRateLimits());

  it("uses the public auth defaults", () => {
    assert.deepEqual(AUTH_LIMITS.register, { limit: 5, windowMs: 60 * 60 * 1000 });
    assert.deepEqual(AUTH_LIMITS.login, { limit: 10, windowMs: 15 * 60 * 1000 });
    assert.deepEqual(AUTH_LIMITS.forgotPassword, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
  });

  it("blocks the next register attempt from the same IP after the hourly cap", () => {
    const now = 5_000_000;
    for (let i = 0; i < AUTH_LIMITS.register.limit; i++) {
      assert.equal(consumeAuthLimit("register", "203.0.113.8", now + i).ok, true);
    }
    assert.equal(consumeAuthLimit("register", "203.0.113.8", now + 10).ok, false);
    assert.equal(consumeAuthLimit("register", "203.0.113.9", now + 10).ok, true);
    assert.equal(consumeAuthLimit("login", "203.0.113.8", now + 10).ok, true);
  });

  it("counts a login attempt once inside a single request scope", async () => {
    const now = 9_000;
    await withRateLimitScope(async () => {
      assert.equal(consumeAuthLimit("login", "198.51.100.4", now).ok, true);
      assert.equal(consumeAuthLimit("login", "198.51.100.4", now).ok, true);
    });
    let allowed = 0;
    for (let i = 0; i < AUTH_LIMITS.login.limit; i++) {
      if (consumeAuthLimit("login", "198.51.100.4", now).ok) allowed++;
    }
    assert.equal(allowed, AUTH_LIMITS.login.limit - 1);
  });

  it("does not describe the rule in the visitor message", () => {
    assert.match(AUTH_RATE_LIMIT_MESSAGE, /too many attempts/i);
    assert.equal(/ip address|x-forwarded|rate limit|gmail|disposable/i.test(AUTH_RATE_LIMIT_MESSAGE), false);
  });
});

describe("clientIpFromHeaders", () => {
  it("prefers a single Railway X-Real-IP over a spoofed forwarding chain", () => {
    const ip = clientIpFromHeaders(
      headers({
        "x-real-ip": "203.0.113.10",
        "x-forwarded-for": "198.51.100.1, 203.0.113.10",
      })
    );
    assert.equal(ip, "203.0.113.10");
  });

  it("falls back to the first valid X-Forwarded-For address", () => {
    assert.equal(
      clientIpFromHeaders(headers({ "x-forwarded-for": "198.51.100.20, 10.0.0.4" })),
      "198.51.100.20"
    );
    assert.equal(
      clientIpFromHeaders(headers({ "x-forwarded-for": "not-an-ip, 192.0.2.15" })),
      "192.0.2.15"
    );
  });

  it("rejects a list stuffed into X-Real-IP and ignores junk", () => {
    assert.equal(
      clientIpFromHeaders(
        headers({ "x-real-ip": "1.2.3.4, 5.6.7.8", "x-forwarded-for": "192.0.2.8" })
      ),
      "192.0.2.8"
    );
    assert.equal(clientIpFromHeaders(headers({ "x-real-ip": "definitely-not" })), "unknown");
    assert.equal(clientIpFromHeaders(headers({})), "unknown");
  });

  it("normalizes mapped IPv4 and bracketed IPv6", () => {
    assert.equal(
      clientIpFromHeaders(headers({ "x-real-ip": "::ffff:203.0.113.7" })),
      "203.0.113.7"
    );
    assert.equal(
      clientIpFromHeaders(headers({ "x-real-ip": "[2001:db8::1]" })),
      "2001:db8::1"
    );
  });
});
