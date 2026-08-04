"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import {
  findOrCreateConversation,
  loadDirectory,
  loadThread,
  type DirectoryEntry,
  type Thread,
} from "@/lib/messages";

const MAX_BODY = 4000;

function refresh() {
  revalidatePath("/messages");
  revalidatePath("/dashboard");
}

/** Send a message into an existing conversation the sender belongs to. */
export async function sendMessage(args: {
  conversationId: string;
  body: string;
}): Promise<{ ok: boolean }> {
  const session = await requireUser();
  const userId = session.user!.id;
  const body = args.body.trim();
  if (!body) return { ok: false };

  const part = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId: args.conversationId, userId },
    },
  });
  if (!part) return { ok: false };

  await prisma.message.create({
    data: {
      conversationId: args.conversationId,
      senderId: userId,
      body: body.slice(0, MAX_BODY),
    },
  });
  // Bump the conversation so it floats to the top of every inbox (@updatedAt).
  await prisma.conversation.update({
    where: { id: args.conversationId },
    data: {},
  });
  // Sending implies the sender has read the thread up to now.
  await prisma.conversationParticipant.update({
    where: { id: part.id },
    data: { lastReadAt: new Date() },
  });

  refresh();
  return { ok: true };
}

/**
 * Start (or reuse) a 1:1 conversation with another member and send the first
 * message. Returns the conversation id so the client can open the thread.
 */
export async function startConversation(args: {
  otherId: string;
  body: string;
}): Promise<{ conversationId: string | null }> {
  const session = await requireUser();
  const userId = session.user!.id;
  const body = args.body.trim();
  if (!args.otherId || args.otherId === userId || !body) {
    return { conversationId: null };
  }

  const other = await prisma.user.findFirst({
    where: {
      id: args.otherId,
      status: "APPROVED",
      // Audience isolation: learners can only message peers on their own side.
      // Admins are audience-neutral and can message anyone.
      ...(session.user!.role === "ADMIN"
        ? {}
        : { audience: session.user!.audience }),
    },
    select: { id: true },
  });
  if (!other) return { conversationId: null };

  const conversationId = await findOrCreateConversation(userId, args.otherId);
  await sendMessage({ conversationId, body });
  return { conversationId };
}

/** Mark a conversation read up to now, clearing its unread badge. */
export async function markRead(args: {
  conversationId: string;
}): Promise<void> {
  const session = await requireUser();
  const userId = session.user!.id;
  const part = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId: args.conversationId, userId },
    },
  });
  if (!part) return;
  await prisma.conversationParticipant.update({
    where: { id: part.id },
    data: { lastReadAt: new Date() },
  });
  refresh();
}

/** Open a thread for the viewer and mark it read in one round-trip. */
export async function getThread(args: {
  conversationId: string;
}): Promise<Thread | null> {
  const session = await requireUser();
  const userId = session.user!.id;
  const thread = await loadThread(userId, args.conversationId);
  if (thread) {
    await markRead({ conversationId: args.conversationId });
  }
  return thread;
}

/** Search approved members to start a new direct message. */
export async function searchDirectory(args: {
  query: string;
}): Promise<DirectoryEntry[]> {
  const session = await requireUser();
  return loadDirectory(session.user!.id, args.query, {
    audience: session.user!.audience,
    role: session.user!.role,
  });
}
