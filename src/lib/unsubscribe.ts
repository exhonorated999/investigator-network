import { appUrl } from "@/lib/email-template";
import { briefDbError } from "@/lib/db-errors";
import { openUnsubToken } from "@/lib/unsub-token";
import {
  defaultJournalPath,
  forgetPending,
  listPending,
  rememberPending,
  updatePendingEmail,
  type PendingUnsubscribe,
  type RememberResult,
} from "@/lib/unsubscribe-journal";

/**
 * Campaign unsubscribe.
 *
 * GET only shows a confirmation page. Security scanners and mailbox link
 * prefetches GET the URL, and the Nov 16 links already in inboxes keep
 * working: the same URL now renders a button that POSTs the token.
 *
 * POST applies the opt-out when it is either the confirm button or an
 * RFC 8058 one-click request (`List-Unsubscribe=One-Click`, which is what
 * Outlook's Microsoft.OWS.Api client sends). The write is a Suppression
 * upsert plus Contact status UNSUBSCRIBED. User accounts are not deleted.
 *
 * Every attempt emits one JSON log line that includes the token, because
 * Railway's HTTP logs strip query strings. If Postgres is down the record
 * is also appended to the journal on the upload volume and replayed by
 * the reconciler (interval, health check, and campaign cron) once a query
 * succeeds. The handler always answers 200 on a real opt-out so the person
 * never sees a server error and a one-click client treats it as accepted.
 */

const TOKEN_RE = /^[A-Za-z0-9._~-]{1,2000}$/;
const REQUEST_DEADLINE_MS = 8000;
const RECONCILE_DEADLINE_MS = 20_000;
const RECONCILE_INTERVAL_MS = 30_000;

const PREFETCH_UAS = [
  "safelinks",
  "proofpoint",
  "mimecast",
  "barracuda",
  "trend micro",
  "trendmicro",
  "googleimageproxy",
  "skypeuripreview",
  "slackbot",
  "whatsapp",
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "discordbot",
  "telegrambot",
  "applebot",
  "bingpreview",
];

export interface UnsubscribeBackend {
  /** Legacy opaque token → address. Throws when the database is unreachable. */
  findEmailByToken(token: string): Promise<string | null>;
  /** Suppression upsert + contact status. Throws when the write does not land. */
  suppress(email: string): Promise<void>;
}

export interface UnsubscribeRequest {
  method: "GET" | "POST";
  url: string;
  body?: string;
  headers?: { get(name: string): string | null };
}

export interface UnsubscribeOptions {
  backend?: UnsubscribeBackend;
  journalPath?: string;
  /** undefined reads the env; null disables sealed tokens (tests, no secret). */
  secret?: string | null;
  log?: (level: "info" | "error", line: string) => void;
  now?: () => Date;
  deadlineMs?: number;
  maxPending?: number;
}

export interface UnsubscribeResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface DrainResult {
  applied: number;
  dropped: number;
  pending: number;
}

declare global {
  var __unsubReconcilerStarted: boolean | undefined;
}

class DeadlineError extends Error {
  constructor() {
    super("unsubscribe deadline exceeded");
    this.name = "DeadlineError";
  }
}

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return work;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new DeadlineError()), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

let backendPromise: Promise<UnsubscribeBackend> | null = null;

function defaultBackend(): Promise<UnsubscribeBackend> {
  if (!backendPromise) {
    backendPromise = import("./unsubscribe-db").then((mod) => ({
      findEmailByToken: mod.findCampaignEmail,
      suppress: mod.suppressEmail,
    }));
  }
  return backendPromise;
}

function emit(
  opts: UnsubscribeOptions,
  level: "info" | "error",
  fields: Record<string, unknown>
) {
  const line = JSON.stringify({ event: "unsubscribe", ...fields });
  if (opts.log) {
    opts.log(level, line);
    return;
  }
  if (level === "error") console.error(line);
  else console.log(line);
}

export function looksLikePrefetch(
  headers: { get(name: string): string | null } | undefined
): boolean {
  if (!headers) return false;
  const purpose = [headers.get("purpose"), headers.get("sec-purpose"), headers.get("x-purpose"), headers.get("x-moz")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/(prefetch|preview)/.test(purpose)) return true;
  const ua = (headers.get("user-agent") || "").toLowerCase();
  return PREFETCH_UAS.some((needle) => ua.includes(needle));
}

/** Outlook's one-click client. Honored even if a proxy drops the form body. */
export function isMailboxOneClickAgent(userAgent: string | null | undefined): boolean {
  return /microsoft\.ows\.api/i.test(userAgent || "");
}

export function isOneClickPost(body: string | undefined): boolean {
  if (!body) return false;
  const slice = body.slice(0, 8192).replace(/^\uFEFF/, "");
  const params = new URLSearchParams(slice);
  for (const [key, value] of params.entries()) {
    if (
      key.trim().toLowerCase() === "list-unsubscribe" &&
      value.trim().toLowerCase() === "one-click"
    ) {
      return true;
    }
  }
  return false;
}

export function isConfirmPost(body: string | undefined): boolean {
  if (!body) return false;
  return new URLSearchParams(body.slice(0, 8192)).get("confirm") === "1";
}

export function readUnsubscribeToken(url: string, body?: string): string {
  let token = "";
  try {
    token = new URL(url).searchParams.get("token")?.trim() || "";
  } catch {
    token = "";
  }
  if (!token && body) {
    const slice = body.slice(0, 8192);
    token = new URLSearchParams(slice).get("token")?.trim() || "";
    if (!token) {
      const match = /(?:^|[&\s])token=([^&\s]+)/.exec(slice);
      if (match) {
        try {
          token = decodeURIComponent(match[1]).trim();
        } catch {
          token = match[1].trim();
        }
      }
    }
  }
  return token;
}

function userAgentOf(req: UnsubscribeRequest): string | undefined {
  const ua = req.headers?.get("user-agent");
  if (!ua) return undefined;
  return ua.replace(/[\r\n]/g, " ").slice(0, 160);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formAction(url: string, token: string): string {
  const query = `token=${encodeURIComponent(token)}`;
  try {
    return `${new URL(url).pathname}?${query}`;
  } catch {
    return `/api/unsubscribe?${query}`;
  }
}

const NO_STORE = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

function htmlResponse(title: string, message: string, extra = ""): UnsubscribeResponse {
  const base = escapeHtml(appUrl());
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="referrer" content="no-referrer"/>
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#0d0f14;color:#e0e8f0;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:520px;margin:12vh auto;padding:32px;background:#141720;border:1px solid #1e2b38;border-radius:12px;text-align:center;">
<div style="height:4px;background:#00b4d8;border-radius:4px;margin:-32px -32px 24px;"></div>
<h1 style="font-size:20px;margin:0 0 12px;">${escapeHtml(title)}</h1>
<p style="color:#8899aa;font-size:15px;line-height:1.6;margin:0 0 20px;">${message}</p>
${extra}
<a href="${base}" style="color:#90e0ef;text-decoration:none;font-size:13px;">Return to Investigator Network</a>
</div></body></html>`;
  return {
    status: 200,
    headers: { ...NO_STORE, "Content-Type": "text/html; charset=utf-8" },
    body: html,
  };
}

function confirmButton(url: string, token: string): string {
  return `<form method="post" action="${escapeHtml(formAction(url, token))}" style="margin:0 0 20px;">
<input type="hidden" name="token" value="${escapeHtml(token)}"/>
<input type="hidden" name="confirm" value="1"/>
<button type="submit" style="background:#00b4d8;color:#0d0f14;border:0;border-radius:8px;padding:12px 22px;font-size:15px;font-weight:bold;cursor:pointer;">Unsubscribe</button>
</form>`;
}

function jsonOk(): UnsubscribeResponse {
  return {
    status: 200,
    headers: { ...NO_STORE, "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true }),
  };
}

function textResponse(status: number, message: string): UnsubscribeResponse {
  return {
    status,
    headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" },
    body: message,
  };
}

function appliedPage(email: string | null): UnsubscribeResponse {
  const message = email
    ? `${escapeHtml(email)} has been removed from our email campaigns. You won't receive further newsletters or announcements.`
    : "You've been removed from our email campaigns. You won't receive further newsletters or announcements.";
  return htmlResponse("You're unsubscribed", message);
}

function receivedPage(email: string | null): UnsubscribeResponse {
  const message = email
    ? `We received your request to unsubscribe ${escapeHtml(email)}. It will be processed shortly, and you won't receive further campaign emails.`
    : "We received your unsubscribe request. It will be processed shortly, and you won't receive further campaign emails.";
  return htmlResponse("Request received", message);
}

function confirmPage(url: string, token: string, email: string | null): UnsubscribeResponse {
  const message = email
    ? `Confirm that you want to stop campaign emails to ${escapeHtml(email)}. Opening this page does not unsubscribe you. Account and password messages are not affected.`
    : "Confirm that you want to stop campaign emails from Investigator Network. Opening this page does not unsubscribe you. Account and password messages are not affected.";
  return htmlResponse("Confirm unsubscribe", message, confirmButton(url, token));
}

function resolveSecret(opts: UnsubscribeOptions): string | null {
  if (opts.secret !== undefined) return opts.secret || null;
  const value = (process.env.UNSUBSCRIBE_SECRET || process.env.AUTH_SECRET || "").trim();
  return value || null;
}

async function resolveBackend(opts: UnsubscribeOptions): Promise<UnsubscribeBackend> {
  return opts.backend ?? (await defaultBackend());
}

type ApplyOutcome =
  | { status: "applied"; email: string }
  | { status: "unknown" }
  | { status: "deferred"; email: string | null; error: unknown };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Resolve the address (sealed token, journal, or database) and write the
 * suppression. Database failures defer; a definitive miss is unknown.
 */
async function applyOptOut(
  token: string,
  knownEmail: string | null,
  backend: UnsubscribeBackend,
  secret: string | null,
  deadlineMs: number,
  onEmail: (email: string) => Promise<void>
): Promise<ApplyOutcome> {
  let email = knownEmail ? normalizeEmail(knownEmail) : openUnsubToken(token, secret);
  try {
    if (!email) {
      const found = await withDeadline(backend.findEmailByToken(token), deadlineMs);
      if (!found) return { status: "unknown" };
      email = normalizeEmail(found);
      await onEmail(email);
    }
    await withDeadline(backend.suppress(email), deadlineMs);
    return { status: "applied", email };
  } catch (err) {
    return { status: "deferred", email, error: err };
  }
}

export async function handleUnsubscribe(
  req: UnsubscribeRequest,
  opts: UnsubscribeOptions = {}
): Promise<UnsubscribeResponse> {
  const now = opts.now ?? (() => new Date());
  const file = opts.journalPath ?? defaultJournalPath();
  const secret = resolveSecret(opts);
  const token = readUnsubscribeToken(req.url, req.body);
  const ua = userAgentOf(req);
  const prefetch = req.method === "GET" && looksLikePrefetch(req.headers);

  if (!token || !TOKEN_RE.test(token)) {
    emit(opts, "error", {
      phase: "result",
      source: "request",
      method: req.method,
      via: req.method === "GET" ? "link" : "other",
      token: "",
      email: null,
      outcome: "invalid",
      tokenLength: token.length,
      ua,
    });
    if (req.method === "POST") return textResponse(400, token ? "Invalid token" : "Missing token");
    return htmlResponse(
      "Invalid link",
      "This unsubscribe link is missing its token."
    );
  }

  try {
    const emailFromToken = openUnsubToken(token, secret);
    const oneClick =
      req.method === "POST" &&
      (isOneClickPost(req.body) || isMailboxOneClickAgent(ua));
    const confirm = req.method === "POST" && isConfirmPost(req.body) && !oneClick;

    if (req.method === "GET") {
      emit(opts, "info", {
        phase: "result",
        source: "request",
        method: "GET",
        via: "link",
        token,
        email: emailFromToken,
        outcome: "confirm",
        prefetch,
        ua,
      });
      return confirmPage(req.url, token, emailFromToken);
    }

    if (!oneClick && !confirm) {
      emit(opts, "info", {
        phase: "result",
        source: "request",
        method: "POST",
        via: "other",
        token,
        email: emailFromToken,
        outcome: "ignored",
        ua,
      });
      return jsonOk();
    }

    const via: PendingUnsubscribe["via"] = oneClick ? "one-click" : "confirm";
    emit(opts, "info", {
      phase: "attempt",
      source: "request",
      method: "POST",
      via,
      token,
      email: emailFromToken,
      ua,
    });

    // Journal before the database call. A hung or killed request still
    // leaves a record that the reconciler can apply.
    const journaled = await rememberPending(
      file,
      { token, email: emailFromToken, via, at: now().toISOString() },
      { maxPending: opts.maxPending }
    );

    const backend = await resolveBackend(opts);
    const outcome = await applyOptOut(
      token,
      emailFromToken,
      backend,
      secret,
      opts.deadlineMs ?? REQUEST_DEADLINE_MS,
      (email) => updatePendingEmail(file, token, email)
    );

    if (outcome.status === "applied") {
      await forgetPending(file, token);
      emit(opts, "info", {
        phase: "result",
        source: "request",
        method: "POST",
        via,
        token,
        email: outcome.email,
        outcome: "applied",
        ua,
      });
      return oneClick ? jsonOk() : appliedPage(outcome.email);
    }

    if (outcome.status === "unknown") {
      await forgetPending(file, token);
      emit(opts, "info", {
        phase: "result",
        source: "request",
        method: "POST",
        via,
        token,
        email: null,
        outcome: "unknown",
        ua,
      });
      if (oneClick) return jsonOk();
      return htmlResponse(
        "Link not recognized",
        "We couldn't match this unsubscribe link. You may already be unsubscribed."
      );
    }

    emit(opts, "error", {
      phase: "result",
      source: "request",
      method: "POST",
      via,
      token,
      email: outcome.email,
      outcome: "queued",
      journal: journaled,
      error: briefDbError(outcome.error),
      ua,
    });
    return oneClick ? jsonOk() : receivedPage(outcome.email);
  } catch (err) {
    emit(opts, "error", {
      phase: "result",
      source: "request",
      method: req.method,
      via: req.method === "GET" ? "link" : "confirm",
      token,
      email: null,
      outcome: "queued",
      journal: "memory" satisfies RememberResult,
      error: briefDbError(err),
      ua,
    });
    if (req.method === "GET") return confirmPage(req.url, token, null);
    if (isOneClickPost(req.body) || isMailboxOneClickAgent(ua)) return jsonOk();
    return receivedPage(null);
  }
}

export async function drainPendingUnsubscribes(
  opts: UnsubscribeOptions = {}
): Promise<DrainResult> {
  const file = opts.journalPath ?? defaultJournalPath();
  const secret = resolveSecret(opts);
  let applied = 0;
  let dropped = 0;
  try {
    const backend = await resolveBackend(opts);
    const items = await listPending(file);
    for (const item of items) {
      const known = item.email || openUnsubToken(item.token, secret);
      const outcome = await applyOptOut(
        item.token,
        known,
        backend,
        secret,
        opts.deadlineMs ?? RECONCILE_DEADLINE_MS,
        (email) => updatePendingEmail(file, item.token, email)
      );
      if (outcome.status === "deferred") {
        emit(opts, "error", {
          phase: "result",
          source: "reconcile",
          method: "POST",
          via: item.via,
          token: item.token,
          email: outcome.email,
          outcome: "queued",
          error: briefDbError(outcome.error),
          pending: items.length - applied - dropped,
        });
        return { applied, dropped, pending: items.length - applied - dropped };
      }
      await forgetPending(file, item.token);
      if (outcome.status === "unknown") {
        dropped++;
        emit(opts, "info", {
          phase: "result",
          source: "reconcile",
          method: "POST",
          via: item.via,
          token: item.token,
          email: null,
          outcome: "unknown",
        });
        continue;
      }
      applied++;
      emit(opts, "info", {
        phase: "result",
        source: "reconcile",
        method: "POST",
        via: item.via,
        token: item.token,
        email: outcome.email,
        outcome: "applied",
      });
    }
    return { applied, dropped, pending: 0 };
  } catch (err) {
    emit(opts, "error", {
      phase: "result",
      source: "reconcile",
      outcome: "queued",
      error: briefDbError(err),
    });
    return { applied, dropped, pending: 0 };
  }
}

/** Retry queued opt-outs every 30s for as long as this process is up. */
export function startUnsubscribeReconciler(): void {
  if (globalThis.__unsubReconcilerStarted) return;
  globalThis.__unsubReconcilerStarted = true;
  console.log("[unsubscribe] reconciler started");
  const run = () => {
    void drainPendingUnsubscribes().catch(() => {});
  };
  setTimeout(run, 5_000).unref?.();
  setInterval(run, RECONCILE_INTERVAL_MS).unref?.();
}
