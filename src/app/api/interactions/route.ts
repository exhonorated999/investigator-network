import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readNotesDoc } from "@/lib/blocks";
import {
  collectInteractive,
  isInteractionComplete,
  parseInteractionPayload,
} from "@/lib/blocks";
import {
  computeGate,
  loadInteractions,
  recordInteraction,
} from "@/lib/interactions";

/**
 * Record a learner's answer to one interactive block.
 *
 * A route handler rather than a server action: these fire on every tick of a
 * checklist, so they must be cheap, fire-and-forget, and must NOT trigger a
 * revalidation of the whole page. The client keeps its own optimistic state
 * and only needs the gate status back.
 *
 * Body: { unitId, blockId, payload }
 * Returns: { complete, gate: { satisfied, total, passed } }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const o = (body ?? {}) as Record<string, unknown>;
  const unitId = String(o.unitId ?? "");
  const blockId = String(o.blockId ?? "");
  if (!unitId || !blockId) {
    return NextResponse.json({ error: "Missing unitId or blockId" }, { status: 400 });
  }

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { id: true, type: true, data: true, section: { select: { courseId: true } } },
  });
  if (!unit || unit.type !== "NOTES") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only enrolled learners may record progress. Admins are previewing, so let
  // them exercise the blocks without polluting anyone's record — including
  // their own, since an admin preview is not a course attempt.
  const isAdmin = session.user.role === "ADMIN";
  const enrolled = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: { userId, courseId: unit.section.courseId },
    },
    select: { id: true },
  });
  if (!enrolled && !isAdmin) {
    return NextResponse.json({ error: "Not enrolled" }, { status: 403 });
  }

  const blocks = readNotesDoc((unit.data as Record<string, unknown>) ?? {}).blocks;

  if (!enrolled && isAdmin) {
    // Preview mode: evaluate the answer so the admin sees real feedback, but
    // persist nothing and never gate — a preview is not a course attempt.
    const ref = collectInteractive(blocks).find((r) => r.block.id === blockId);
    const complete = ref
      ? isInteractionComplete(ref.block, parseInteractionPayload(o.payload))
      : false;
    return NextResponse.json({
      complete,
      preview: true,
      gate: { outstanding: [], total: 0, satisfied: 0, passed: true },
    });
  }

  const result = await recordInteraction(userId, unitId, blocks, blockId, o.payload);
  if (!result) {
    return NextResponse.json({ error: "Unknown block" }, { status: 404 });
  }

  const answers = await loadInteractions(userId, unitId);
  const gate = computeGate(blocks, answers);

  return NextResponse.json({ complete: result.complete, gate });
}
