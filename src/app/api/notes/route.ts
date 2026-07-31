import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseBlocks } from "@/lib/blocks";

/**
 * Autosave the whole block document for a NOTES unit.
 *
 * A route handler rather than a server action, for the same reason the
 * interactions endpoint is one: the visual editor saves on a debounce while the
 * admin is still typing, and a server action would revalidate and re-render the
 * page underneath them on every save. The editor owns the document in client
 * state; this endpoint just persists it.
 *
 * The incoming blocks are re-parsed through `parseBlocks` before writing. The
 * client is trusted enough (admin only) but the parser is what guarantees the
 * stored shape, and it is also what strips anything a hand-edited JSON payload
 * got wrong. What comes back out of the parser is what gets written, so the
 * client is told the canonical result rather than assuming its own copy won.
 *
 * Body: { unitId, blocks }
 * Returns: { savedAt, blockCount }
 */
export async function PUT(req: Request) {
  const session = await auth();
  // Every other admin surface is ADMIN-only via requireAdmin(); this endpoint
  // writes the same data, so it uses the same bar rather than a looser one.
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const o = (body ?? {}) as Record<string, unknown>;
  const unitId = String(o.unitId ?? "");
  if (!unitId) {
    return NextResponse.json({ error: "Missing unitId" }, { status: 400 });
  }
  if (!Array.isArray(o.blocks)) {
    return NextResponse.json({ error: "blocks must be an array" }, { status: 400 });
  }

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { id: true, type: true },
  });
  if (!unit) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }
  if (unit.type !== "NOTES") {
    return NextResponse.json({ error: "Not a NOTES unit" }, { status: 400 });
  }

  const blocks = parseBlocks(o.blocks);

  await prisma.unit.update({
    where: { id: unitId },
    data: { data: { version: 1, blocks } as unknown as object },
  });

  // The learner-facing pages are cached; the editor page is deliberately NOT
  // revalidated, because the client already holds the newer copy and a
  // revalidation would yank the document out from under an admin mid-keystroke.
  // Revalidating the whole /courses layout avoids needing the slug here.
  revalidatePath("/courses", "layout");

  return NextResponse.json({
    savedAt: new Date().toISOString(),
    blockCount: blocks.length,
    blocks,
  });
}
