import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Self-contained unsubscribe tokens.
 *
 * Legacy campaign links carry an opaque hex token that only the database can
 * resolve. New sends seal the recipient address with AES-256-GCM so an opt-out
 * can still be honored when Postgres is down. The sealed token is also stored
 * on CampaignRecipient, so a rotated secret falls back to the database lookup.
 *
 * The key is UNSUBSCRIBE_SECRET, or AUTH_SECRET when that is unset. Both are
 * already stable production secrets; no extra infrastructure is required.
 */

const VERSION = "v1";
const IV_LEN = 12;
const TAG_LEN = 16;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function unsubscribeSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = (env.UNSUBSCRIBE_SECRET || env.AUTH_SECRET || "").trim();
  return value || null;
}

function keyFrom(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

export function isUnsubscribeEmail(value: string): boolean {
  return value.length <= 320 && EMAIL_RE.test(value);
}

/** Encrypt `{ e: email }` so the address is not readable from the link. */
export function sealUnsubToken(email: string, secret: string): string {
  const normalized = email.trim().toLowerCase();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify({ e: normalized }), "utf8"),
    cipher.final(),
  ]);
  const packed = Buffer.concat([iv, ciphertext, cipher.getAuthTag()]);
  return `${VERSION}.${packed.toString("base64url")}`;
}

/** Returns the sealed address, or null when the token is legacy or forged. */
export function openUnsubToken(token: string, secret: string | null): string | null {
  if (!secret || !token.startsWith(`${VERSION}.`)) return null;
  try {
    const packed = Buffer.from(token.slice(VERSION.length + 1), "base64url");
    if (packed.length < IV_LEN + TAG_LEN + 2) return null;
    const iv = packed.subarray(0, IV_LEN);
    const tag = packed.subarray(packed.length - TAG_LEN);
    const ciphertext = packed.subarray(IV_LEN, packed.length - TAG_LEN);
    const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const parsed = JSON.parse(plain.toString("utf8")) as { e?: unknown };
    if (typeof parsed.e !== "string") return null;
    const email = parsed.e.trim().toLowerCase();
    return isUnsubscribeEmail(email) ? email : null;
  } catch {
    return null;
  }
}

let warnedUnsigned = false;

/**
 * Token stored on CampaignRecipient and placed in the unsubscribe link.
 * Falls back to an opaque hex token when no signing secret is configured so
 * a send still goes out; those links resolve through the database only.
 */
export function createUnsubToken(email: string, secret?: string | null): string {
  const key = secret === undefined ? unsubscribeSecret() : secret;
  const normalized = email.trim().toLowerCase();
  if (!key || !isUnsubscribeEmail(normalized)) {
    if (secret === undefined && !key && !warnedUnsigned) {
      warnedUnsigned = true;
      console.warn(
        "unsubscribe: AUTH_SECRET is unset, so new unsubscribe links cannot embed the recipient"
      );
    }
    return randomBytes(18).toString("hex");
  }
  return sealUnsubToken(normalized, key);
}

export function buildUnsubscribeUrl(token: string, base: string): string {
  const root = base.replace(/\/+$/, "");
  return `${root}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** RFC 8058 one-click headers. Values are stripped of header-injection characters. */
export function listUnsubscribeHeaders(unsubscribeUrl: string): {
  "List-Unsubscribe": string;
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click";
} {
  const safe = unsubscribeUrl.replace(/[\r\n<>]/g, "");
  return {
    "List-Unsubscribe": `<${safe}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
