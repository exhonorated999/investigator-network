import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Auto-save a learner's in-progress answers for a quiz so a long test can be
 * left and resumed later without losing work.
 *
 * A route handler rather than a server action: it fires on every answer change
 * (debounced client-side), so it must be cheap, fire-and-forget, and must NOT
 * revalidate the page. The draft is a scratch pad only — it is never graded and
 * is deleted the moment the learner submits an attempt (see submitAttempt).
 *
 * Body: { unitId, answers } where answers maps questionId -> choiceId (string)
 *        or choiceId[] (multi-select). File-upload answers are not stored: a
 *        browser will not let JavaScript re-populate a file input.
 * Returns: { ok: true }
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
  if (!unitId) {
    return NextResponse.json({ error: "Missing unitId" }, { status: 400 });
  }

  const quiz = await prisma.quiz.findUnique({
    where: { unitId },
    select: { id: true, unit: { select: { section: { select: { courseId: true } } } } },
  });
  if (!quiz) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only enrolled learners (or admins previewing) may keep a draft. Admins are
  // let through so they can test the resume flow.
  const isAdmin = session.user.role === "ADMIN";
  const enrolled = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: quiz.unit.section.courseId } },
    select: { id: true },
  });
  if (!enrolled && !isAdmin) {
    return NextResponse.json({ error: "Not enrolled" }, { status: 403 });
  }

  // Normalise: keep only string / string[] values keyed by question id.
  const raw = (o.answers ?? {}) as Record<string, unknown>;
  const answers: Record<string, string | string[]> = {};
  for (const [qid, val] of Object.entries(raw)) {
    if (Array.isArray(val)) {
      const arr = val.map(String).filter(Boolean);
      if (arr.length) answers[qid] = arr;
    } else if (typeof val === "string" && val) {
      answers[qid] = val;
    }
  }

  await prisma.quizDraft.upsert({
    where: { userId_quizId: { userId, quizId: quiz.id } },
    update: { answers },
    create: { userId, quizId: quiz.id, answers },
  });

  return NextResponse.json({ ok: true });
}
