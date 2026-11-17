import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { briefDbError } from "@/lib/db-errors";
import { recordHeartbeat } from "@/lib/presence";

/**
 * Presence heartbeat. The client beacon POSTs the path it is currently on.
 *
 * Deliberately uses `auth()` rather than `getViewerUser()`: presence must
 * reflect the REAL signed-in account. If an admin is previewing as a learner,
 * we want the admin marked online — not a fake "learner is online" row.
 */
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new NextResponse(null, { status: 204 });

  let path = "/";
  try {
    const body = (await req.json()) as { path?: unknown };
    if (typeof body.path === "string" && body.path.startsWith("/")) {
      path = body.path;
    }
  } catch {
    // Empty or malformed body — fall back to "/".
  }

  try {
    await recordHeartbeat(userId, path);
  } catch (err) {
    // Telemetry must not fail the beacon. Log so a dead database is visible.
    console.error(`presence heartbeat failed (${briefDbError(err)})`);
  }

  return new NextResponse(null, { status: 204 });
}
