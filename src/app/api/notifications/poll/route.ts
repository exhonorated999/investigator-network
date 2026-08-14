import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadUnreadCount } from "@/lib/messages";
import { countOpenQuestions } from "@/lib/course-forum";

/**
 * Lightweight polling endpoint for the in-app notification watcher.
 *
 * Returns the signed-in user's live counts so the client can play a chime and
 * badge the tab when something new arrives:
 *   - messages:  unread direct-message conversations (everyone)
 *   - questions: open course questions needing staff (admins only; 0 otherwise)
 *
 * Always reads for the REAL signed-in user (session.user.id), never an
 * impersonated preview account.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ messages: 0, questions: 0 }, { status: 401 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const [messages, questions] = await Promise.all([
    loadUnreadCount(userId),
    isAdmin ? countOpenQuestions() : Promise.resolve(0),
  ]);

  return NextResponse.json(
    { messages, questions },
    { headers: { "Cache-Control": "no-store" } }
  );
}
