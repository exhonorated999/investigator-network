import { NextResponse } from "next/server";
import { briefDbError } from "@/lib/db-errors";
import { pingDatabase } from "@/lib/prisma";
import { drainPendingUnsubscribes } from "@/lib/unsubscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness probe for Railway. Runs `SELECT 1` and returns 200 or 503.
 * The body is only `{ ok }` — database errors stay in the server log.
 */
export async function GET() {
  try {
    await pingDatabase();
    // Replay opt-outs captured while the database was down. Not awaited:
    // a long queue must not fail the liveness probe. The in-process
    // reconciler retries the same journal.
    void drainPendingUnsubscribes().catch((err) => {
      console.error(`health: unsubscribe replay failed (${briefDbError(err)})`);
    });
    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error(`health: database unreachable (${briefDbError(err)})`);
    return NextResponse.json(
      { ok: false },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "5" },
      }
    );
  }
}
