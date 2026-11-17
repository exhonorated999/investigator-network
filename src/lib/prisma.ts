import { PrismaClient } from "@/generated/prisma";
import { retryTransient } from "@/lib/db-errors";

// Reuse a single PrismaClient across hot reloads in development to avoid
// exhausting the database connection pool.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof makeClient> | undefined;
};

/**
 * Neon closes idle connections. The first query afterwards can fail with
 * "Server has closed the connection" (P1017) or "Can't reach database server"
 * (P1001). Disconnecting this long-lived singleton is worse: it tears the
 * query engine down for every in-flight request. Those requests then throw
 * `PrismaClientUnknownRequestError: Engine is not yet connected`, and if that
 * error is not retried the process stays dark until restart — which is what a
 * Resend webhook storm did in production.
 *
 * Transient engine and connection errors call `$connect()` and retry the query
 * a couple of times. Request handling never disconnects the singleton.
 * One-shot scripts that own a private PrismaClient may still disconnect when
 * they exit.
 */
function makeClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  // Concurrent requests (a webhook retry storm) share one connect attempt.
  let connectInFlight: Promise<void> | null = null;

  function reconnect(): Promise<void> {
    const existing = connectInFlight;
    if (existing) return existing;
    const pending = base
      .$connect()
      .then(() => undefined)
      .finally(() => {
        if (connectInFlight === pending) connectInFlight = null;
      });
    connectInFlight = pending;
    return pending;
  }

  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        return retryTransient(() => query(args), reconnect);
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * `SELECT 1` through the shared client, so the same reconnect/retry policy
 * applies. Throws when the database is still unreachable after those retries.
 */
export function pingDatabase(): Promise<unknown> {
  return prisma.$queryRaw`SELECT 1`;
}
