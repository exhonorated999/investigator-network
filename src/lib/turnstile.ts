/**
 * Cloudflare Turnstile for public registration.
 *
 * Railway service variables (set both, or neither):
 * - TURNSTILE_SITE_KEY — widget site key. Not a secret. Read when the
 *   signup page renders and passed into the widget. Not a NEXT_PUBLIC_
 *   variable, so it is not frozen into the client bundle at build time.
 * - TURNSTILE_SECRET_KEY — server-only. Sent to Siteverify with the token.
 *
 * If either value is missing, in production or locally, the captcha is
 * skipped and registration continues. The other signup checks still run.
 * Verification turns on only when both values are set. A restart or
 * redeploy picks up a new pair; no code change is required.
 *
 * Do not import this module from a client component. The secret is read
 * here, and only the site key string should cross to the browser.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TOKEN_LENGTH = 2048;

export const TURNSTILE_MISSING_MESSAGE =
  "Check the box that says “Verify you are human,” then submit again.";

export const TURNSTILE_FAILED_MESSAGE =
  "The human check didn't go through. Complete it again, then submit.";

export type TurnstileMode = "verify" | "skip";

export type TurnstileResult =
  | { ok: true; code: "ok" | "skipped" }
  | { ok: false; code: "missing-token" | "rejected" | "unreachable" };

let warnedSkip = false;

export function turnstileMode(
  env: NodeJS.ProcessEnv = process.env
): TurnstileMode {
  const site = env.TURNSTILE_SITE_KEY?.trim() ?? "";
  const secret = env.TURNSTILE_SECRET_KEY?.trim() ?? "";
  if (site && secret) return "verify";
  return "skip";
}

/**
 * Site key for the widget, or null when the widget must not render.
 * Call from the register page after `connection()` so Railway can change
 * the value without a rebuild baking it in.
 */
export function turnstileSiteKey(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  if (turnstileMode(env) !== "verify") return null;
  return env.TURNSTILE_SITE_KEY!.trim();
}

export async function verifyTurnstileToken(
  token: string,
  ip: string | null,
  options?: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
  }
): Promise<TurnstileResult> {
  const env = options?.env ?? process.env;
  const mode = turnstileMode(env);

  if (mode === "skip") {
    if (env === process.env && !warnedSkip) {
      warnedSkip = true;
      const missing = [
        env.TURNSTILE_SITE_KEY?.trim() ? "" : "TURNSTILE_SITE_KEY",
        env.TURNSTILE_SECRET_KEY?.trim() ? "" : "TURNSTILE_SECRET_KEY",
      ].filter(Boolean);
      console.warn(
        `[turnstile] ${missing.join(" and ")} unset; captcha skipped. Registration still works. Set both to turn the check on.`
      );
    }
    return { ok: true, code: "skipped" };
  }

  const trimmed = token.trim();
  if (!trimmed || trimmed.length > MAX_TOKEN_LENGTH) {
    return { ok: false, code: "missing-token" };
  }

  const secret = env.TURNSTILE_SECRET_KEY!.trim();
  const body: { secret: string; response: string; remoteip?: string } = {
    secret,
    response: trimmed,
  };
  if (ip && ip !== "unknown") body.remoteip = ip;

  const fetchImpl = options?.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { ok: false, code: "unreachable" };
    const payload = (await response.json()) as {
      success?: unknown;
      "error-codes"?: unknown;
    };
    if (payload.success === true) return { ok: true, code: "ok" };
    const errors = Array.isArray(payload["error-codes"])
      ? payload["error-codes"].filter((code) => typeof code === "string")
      : [];
    if (errors.length) {
      console.info("[turnstile] siteverify rejected", { errors });
    }
    return { ok: false, code: "rejected" };
  } catch (err) {
    console.info("[turnstile] siteverify unreachable", {
      message: err instanceof Error ? err.message : "unknown",
    });
    return { ok: false, code: "unreachable" };
  }
}
