/**
 * Transient Prisma / Neon failures.
 *
 * Neon closes idle sockets, and a shared PrismaClient can also surface
 * "Engine is not yet connected" after its query engine was torn down. Those
 * are safe to retry once the engine is connected again. Constraint violations,
 * missing rows, and bad input are not.
 */

const TRANSIENT_CODES = new Set([
  "P1001", // Can't reach database server
  "P1002", // Server reached but timed out
  "P1008", // Operation timed out
  "P1017", // Server has closed the connection
  "P2024", // Timed out fetching a connection from the pool
]);

const TRANSIENT_SNIPPETS = [
  "Server has closed the connection",
  "closed the connection",
  "Can't reach database server",
  "Connection terminated",
  "Connection reset",
  "Connection closed",
  "Connection pool timeout",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "Timed out fetching a new connection",
  "not yet connected",
  "Engine was closed",
  "Engine is not connected",
  "Response from the Engine was empty",
  "kind: Closed",
  "terminating connection",
  "socket hang up",
];

/** Initial attempt plus this many retries. */
export const DB_MAX_RETRIES = 2;
/** First retry waits this long; the second waits twice as long. */
export const DB_RETRY_BACKOFF_MS = 100;

function transientText(value: string): boolean {
  return TRANSIENT_SNIPPETS.some((snippet) => value.includes(snippet));
}

export function isTransientDbError(
  err: unknown,
  seen: Set<unknown> = new Set()
): boolean {
  if (err == null) return false;
  if (typeof err === "string") return transientText(err);
  if (typeof err !== "object") return false;
  if (seen.has(err)) return false;
  seen.add(err);

  const rec = err as {
    code?: unknown;
    errorCode?: unknown;
    message?: unknown;
    retryable?: unknown;
    cause?: unknown;
    errors?: unknown;
  };

  if (rec.retryable === true) return true;
  if (typeof rec.code === "string" && TRANSIENT_CODES.has(rec.code)) return true;
  if (typeof rec.errorCode === "string" && TRANSIENT_CODES.has(rec.errorCode)) {
    return true;
  }
  if (typeof rec.message === "string" && transientText(rec.message)) return true;
  if (
    Array.isArray(rec.errors) &&
    rec.errors.some((item) => isTransientDbError(item, seen))
  ) {
    return true;
  }
  if ("cause" in rec && isTransientDbError(rec.cause, seen)) return true;
  return false;
}

/** Last line of a Prisma error, which is the cause rather than the query args. */
export function briefDbError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "unknown error");
  const line =
    msg
      .split("\n")
      .map((part) => part.trim())
      .filter(Boolean)
      .pop() ?? "unknown error";
  return line.slice(0, 200);
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Run `run`. On a transient engine/connection error, call `reconnect` and try
 * again up to {@link DB_MAX_RETRIES} times. `reconnect` must not disconnect
 * the shared client — that is what leaves the engine down for every request.
 */
export async function retryTransient<T>(
  run: () => Promise<T>,
  reconnect: () => Promise<void>,
  sleep: (ms: number) => Promise<void> = defaultSleep
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= DB_MAX_RETRIES; attempt++) {
    try {
      return await run();
    } catch (err) {
      lastErr = err;
      if (!isTransientDbError(err)) throw err;
      try {
        await reconnect();
      } catch {
        // The next attempt (or the rethrow below) reports the query error.
      }
      if (attempt === DB_MAX_RETRIES) throw err;
      await sleep(DB_RETRY_BACKOFF_MS * (attempt + 1));
    }
  }
  throw lastErr;
}
