/**
 * In-memory per-IP limits for public auth actions.
 *
 * Tradeoff: counters live in this Node process. A deploy or restart clears
 * them, and a second Railway replica would keep its own counters (the
 * effective limit would be per replica). That matches a single Railway
 * service. Move this map to Redis or Postgres if the service is ever scaled
 * out.
 *
 * Railway's edge sets `X-Real-IP` to the connecting client
 * (https://docs.railway.com/networking/public-networking). That value is
 * preferred so a caller cannot rotate `X-Forwarded-For` and get a fresh
 * bucket. `X-Forwarded-For` is only a fallback for local dev and proxies
 * that do not send `X-Real-IP`; each token must be a real IP.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { isIP } from "node:net";

export type RateLimitRule = {
  limit: number;
  windowMs: number;
};

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterMs: number };

/**
 * Defaults for a small agency site under signup/login storms.
 * Raise a `limit` or `windowMs` here if real users are getting stuck.
 */
export const AUTH_LIMITS = {
  /** 5 registration attempts per IP per hour. */
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  /** 10 sign-in attempts per IP per 15 minutes. */
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  /** 5 password-reset requests per IP per hour. */
  forgotPassword: { limit: 5, windowMs: 60 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

export type AuthLimitBucket = keyof typeof AUTH_LIMITS;

/** Shown on register, login, and forgot-password. Does not mention the rule or the address. */
export const AUTH_RATE_LIMIT_MESSAGE =
  "Too many attempts from this network. Please wait and try again.";

/**
 * One login form post calls `signIn`, which runs the Auth.js `authorize`
 * callback in the same request. Both check the login bucket; the scope makes
 * the second check free so a single attempt is not counted twice.
 *
 * Stored on globalThis so every server bundle in this process shares one map.
 * Next can emit more than one copy of this module.
 */
const globalLimits = globalThis as typeof globalThis & {
  __authRateLimit?: {
    hits: Map<string, number[]>;
    scope: AsyncLocalStorage<Set<string>>;
  };
};
globalLimits.__authRateLimit ??= {
  hits: new Map<string, number[]>(),
  scope: new AsyncLocalStorage<Set<string>>(),
};
const { hits, scope } = globalLimits.__authRateLimit;

export function withRateLimitScope<T>(fn: () => Promise<T>): Promise<T> {
  return scope.run(new Set(), fn);
}

export function resetRateLimits(): void {
  hits.clear();
}

export function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
  now = Date.now()
): RateLimitResult {
  const fresh = (hits.get(key) ?? []).filter((t) => now - t < rule.windowMs);
  if (fresh.length >= rule.limit) {
    const oldest = fresh[0] ?? now;
    hits.set(key, fresh);
    return { ok: false, retryAfterMs: Math.max(0, oldest + rule.windowMs - now) };
  }
  fresh.push(now);
  hits.set(key, fresh);
  if (hits.size > 10_000) prune(now);
  return { ok: true, remaining: rule.limit - fresh.length };
}

export function consumeAuthLimit(
  bucket: AuthLimitBucket,
  ip: string,
  now = Date.now()
): RateLimitResult {
  const id = `auth:${bucket}:${ip}`;
  const seen = scope.getStore();
  if (seen?.has(id)) return { ok: true, remaining: 0 };
  const result = consumeRateLimit(id, AUTH_LIMITS[bucket], now);
  if (result.ok) seen?.add(id);
  return result;
}

function prune(now: number): void {
  const maxWindow = Math.max(
    ...Object.values(AUTH_LIMITS).map((rule) => rule.windowMs)
  );
  for (const [key, times] of hits) {
    const latest = times[times.length - 1] ?? 0;
    if (now - latest >= maxWindow) hits.delete(key);
  }
}

/**
 * Client IP for rate-limit keys.
 * `X-Real-IP` wins when it is a single address (Railway). Otherwise the
 * first valid address in `X-Forwarded-For`. Missing or junk headers share
 * the bucket `"unknown"` so they cannot mint a new key per request.
 */
export function clientIpFromHeaders(headerList: {
  get(name: string): string | null;
}): string {
  const real = headerList.get("x-real-ip");
  if (real && !real.includes(",")) {
    const ip = normalizeIp(real);
    if (ip) return ip;
  }
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    for (const part of forwarded.split(",")) {
      const ip = normalizeIp(part);
      if (ip) return ip;
    }
  }
  return "unknown";
}

function normalizeIp(raw: string): string | null {
  let value = raw.trim();
  if (!value) return null;
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end === -1) return null;
    value = value.slice(1, end);
  } else {
    const v4Port = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(value);
    if (v4Port) value = v4Port[1];
  }
  if (value.toLowerCase().startsWith("::ffff:")) {
    const mapped = value.slice("::ffff:".length);
    if (isIP(mapped) === 4) value = mapped;
  }
  const kind = isIP(value);
  if (kind === 4) return value;
  if (kind === 6) return value.toLowerCase();
  return null;
}
