import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { InviteTokenPurpose } from "@/generated/prisma";

/**
 * Activation / password-reset links.
 *
 * The raw token exists in exactly two places: the URL we hand to the user, and
 * (briefly) memory. The database only ever holds its SHA-256 hash, so a dump of
 * the InviteToken table is worthless to an attacker. Tokens are single-use and
 * expiring.
 *
 * NOTE: `prisma/import_legacy_users.mjs` mirrors `hashToken` and the token
 * format because a plain Node script cannot import this TypeScript module. If
 * you change the hash algorithm or encoding here, change it there too.
 */

/** Activation links are long-lived: a migration mail-merge may sit unopened. */
export const ACTIVATION_TTL_DAYS = 60;
/** Reset links are short-lived on purpose. */
export const RESET_TTL_DAYS = 2;

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function newRawToken(): string {
  // 32 bytes → 43 base64url chars. Plenty of entropy, still URL- and
  // spreadsheet-safe (no +, / or = to get mangled by a mail merge).
  return randomBytes(32).toString("base64url");
}

/** Absolute origin for links handed to users outside the app. */
export function baseUrl(): string {
  const raw =
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export function activationUrl(rawToken: string): string {
  return `${baseUrl()}/activate/${rawToken}`;
}

export interface IssuedInvite {
  rawToken: string;
  url: string;
  expiresAt: Date;
}

/**
 * Mint a fresh link for a user. Any earlier unused token for the same purpose is
 * consumed first, so re-sending an invite silently invalidates the old link
 * rather than leaving several live doors open.
 */
export async function issueInviteToken(
  userId: string,
  opts: {
    purpose?: InviteTokenPurpose;
    ttlDays?: number;
    issuedBy?: string;
  } = {}
): Promise<IssuedInvite> {
  const purpose = opts.purpose ?? "ACTIVATION";
  const ttlDays =
    opts.ttlDays ??
    (purpose === "ACTIVATION" ? ACTIVATION_TTL_DAYS : RESET_TTL_DAYS);

  const rawToken = newRawToken();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.inviteToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.inviteToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hashToken(rawToken),
        expiresAt,
        issuedBy: opts.issuedBy ?? "",
      },
    }),
  ]);

  return { rawToken, url: activationUrl(rawToken), expiresAt };
}

export type InviteLookup =
  | {
      ok: true;
      purpose: InviteTokenPurpose;
      tokenId: string;
      user: { id: string; name: string; email: string; hasPassword: boolean };
    }
  | { ok: false; reason: "unknown" | "used" | "expired" | "inactive" };

/**
 * Resolve a raw token from a URL. Deliberately distinguishes "used" from
 * "expired" from "unknown" so the page can tell the user something useful —
 * these links are not a secret to be protected from their own owner, and vague
 * errors just generate support email.
 */
export async function lookupInviteToken(raw: string): Promise<InviteLookup> {
  const token = await prisma.inviteToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    select: {
      id: true,
      purpose: true,
      usedAt: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          passwordHash: true,
        },
      },
    },
  });

  if (!token) return { ok: false, reason: "unknown" };
  if (token.usedAt) return { ok: false, reason: "used" };
  if (token.expiresAt.getTime() < Date.now())
    return { ok: false, reason: "expired" };

  // A suspended / denied / removed account must not be able to walk back in
  // through an old invite link.
  const status = token.user.status;
  if (status === "SUSPENDED" || status === "DENIED" || status === "REMOVED")
    return { ok: false, reason: "inactive" };

  return {
    ok: true,
    purpose: token.purpose,
    tokenId: token.id,
    user: {
      id: token.user.id,
      name: token.user.name,
      email: token.user.email,
      hasPassword: Boolean(token.user.passwordHash),
    },
  };
}

/**
 * Set the user's password and burn the token. Every other outstanding token for
 * the account is burned too: once someone proves control of the mailbox and
 * picks a password, older links must stop working.
 */
export async function redeemInviteToken(
  raw: string,
  newPassword: string
): Promise<{ ok: true; email: string } | { ok: false; message: string }> {
  const found = await lookupInviteToken(raw);
  if (!found.ok) {
    const message =
      found.reason === "expired"
        ? "This link has expired. Ask an administrator for a new one."
        : found.reason === "used"
          ? "This link has already been used. Try signing in instead."
          : found.reason === "inactive"
            ? "This account is not active. Contact an administrator."
            : "This link is not valid. Ask an administrator for a new one.";
    return { ok: false, message };
  }

  if (newPassword.length < 8)
    return { ok: false, message: "Password must be at least 8 characters." };

  const passwordHash = await hashPassword(newPassword);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: found.user.id },
      data: { passwordHash },
    }),
    prisma.inviteToken.updateMany({
      where: { userId: found.user.id, usedAt: null },
      data: { usedAt: now },
    }),
  ]);

  return { ok: true, email: found.user.email };
}
