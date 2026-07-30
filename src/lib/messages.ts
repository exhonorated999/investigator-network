/**
 * Direct messages — 1:1 conversations between any two members (learners and
 * staff alike). A conversation is uniquely identified by its pair of
 * participants; `findOrCreateConversation` guarantees only one exists per pair.
 *
 * Unread state is derived from each participant's `lastReadAt` versus the last
 * message time, so there is no per-message read table to maintain.
 */
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma";
import { timeAgo, type Author } from "@/lib/community";

export interface InboxItem {
  conversationId: string;
  other: Author;
  lastMessage: string;
  lastAt: string;
  /** From the current viewer's perspective. */
  unread: boolean;
  fromMe: boolean;
}

export interface ThreadMessage {
  id: string;
  body: string;
  ago: string;
  mine: boolean;
}

export interface Thread {
  conversationId: string;
  other: Author;
  messages: ThreadMessage[];
}

export interface DirectoryEntry {
  id: string;
  name: string;
  agency: string;
  role: Role;
}

const AUTHOR_SELECT = {
  id: true,
  name: true,
  agency: true,
  role: true,
} as const;

/**
 * The viewer's conversations, newest activity first, each collapsed to the
 * other participant + a one-line preview + unread flag.
 */
export async function loadInbox(viewerId: string): Promise<InboxItem[]> {
  const convos = await prisma.conversation.findMany({
    where: { participants: { some: { userId: viewerId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      participants: { include: { user: { select: AUTHOR_SELECT } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const items: InboxItem[] = [];
  for (const c of convos) {
    const mine = c.participants.find((p) => p.userId === viewerId);
    const otherPart = c.participants.find((p) => p.userId !== viewerId);
    if (!otherPart) continue; // skip a malformed / self-only convo
    const last = c.messages[0];
    if (!last) continue; // no messages yet — don't clutter the inbox
    items.push({
      conversationId: c.id,
      other: otherPart.user,
      lastMessage: last.body,
      lastAt: timeAgo(last.createdAt),
      unread: !!mine && last.createdAt > mine.lastReadAt && last.senderId !== viewerId,
      fromMe: last.senderId === viewerId,
    });
  }
  return items;
}

/** Count of conversations with unread messages, for the card badge. */
export async function loadUnreadCount(viewerId: string): Promise<number> {
  const inbox = await loadInbox(viewerId);
  return inbox.filter((i) => i.unread).length;
}

/** Full message list for one conversation. Returns null if not a participant. */
export async function loadThread(
  viewerId: string,
  conversationId: string
): Promise<Thread | null> {
  const convo = await prisma.conversation.findFirst({
    where: { id: conversationId, participants: { some: { userId: viewerId } } },
    include: {
      participants: { include: { user: { select: AUTHOR_SELECT } } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!convo) return null;
  const other = convo.participants.find((p) => p.userId !== viewerId);
  if (!other) return null;

  return {
    conversationId: convo.id,
    other: other.user,
    messages: convo.messages.map((m) => ({
      id: m.id,
      body: m.body,
      ago: timeAgo(m.createdAt),
      mine: m.senderId === viewerId,
    })),
  };
}

/**
 * Find the existing 1:1 conversation between two users, or create one. The two
 * participant rows are created together so the pair is always complete.
 */
export async function findOrCreateConversation(
  viewerId: string,
  otherId: string
): Promise<string> {
  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: viewerId } } },
        { participants: { some: { userId: otherId } } },
      ],
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const convo = await prisma.conversation.create({
    data: {
      participants: {
        create: [{ userId: viewerId }, { userId: otherId }],
      },
    },
    select: { id: true },
  });
  return convo.id;
}

/** Approved members the viewer can start a DM with (everyone but themselves). */
export async function loadDirectory(
  viewerId: string,
  query?: string
): Promise<DirectoryEntry[]> {
  const q = query?.trim();
  return prisma.user.findMany({
    where: {
      id: { not: viewerId },
      status: "APPROVED",
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { agency: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ role: "desc" }, { name: "asc" }],
    take: 30,
    select: AUTHOR_SELECT,
  });
}
