import { PrismaClient } from "@/generated/prisma";

// Reuse a single PrismaClient across hot reloads in development to avoid
// exhausting the database connection pool.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof makeClient> | undefined;
};

/**
 * Neon (serverless Postgres) closes idle connections. Because we hold a long-
 * lived PrismaClient, the *first* query after an idle period can hit a socket
 * Neon already tore down and fail with "Server has closed the connection"
 * (P1017) or a transient "Can't reach database server" (P1001). Prisma re-opens
 * the connection on the next attempt, so these are safe to retry.
 *
 * Without this, that one-off error crashes whatever server render or server
 * action fired it — which on the learner side showed up as the news feed
 * freezing with no article modal. Retrying transparently heals it.
 */
const TRANSIENT = [
  "Server has closed the connection",
  "Can't reach database server",
  "Connection terminated",
  "Connection reset by peer",
  "ECONNRESET",
  "Timed out fetching a new connection",
];

function isTransient(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  if (code === "P1001" || code === "P1017") return true;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return TRANSIENT.some((t) => msg.includes(t));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        let lastErr: unknown;
        // Initial try + up to 3 retries with small backoff.
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            return await query(args);
          } catch (err) {
            lastErr = err;
            if (!isTransient(err) || attempt === 3) throw err;
            // Drop the dead connection so the next call re-dials Neon.
            try {
              await base.$disconnect();
            } catch {
              /* ignore */
            }
            await sleep(150 * (attempt + 1));
          }
        }
        throw lastErr;
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
