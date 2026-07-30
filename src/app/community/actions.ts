"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { isReactionKind, isTopic } from "@/lib/community";

const MAX_BODY = 4000;

function refresh() {
  revalidatePath("/community");
  revalidatePath("/dashboard");
}

/** Create a post in a topic. Author is always the real signed-in user. */
export async function createPost(formData: FormData) {
  const session = await requireUser();
  const userId = session.user!.id;

  const topic = String(formData.get("topic") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;
  if (!isTopic(topic) || !body) return;

  await prisma.post.create({
    data: { authorId: userId, topic, body: body.slice(0, MAX_BODY), imageUrl },
  });
  refresh();
}

/** Add an answer to a post, or a threaded reply to another comment. */
export async function createComment(formData: FormData) {
  const session = await requireUser();
  const userId = session.user!.id;

  const postId = String(formData.get("postId") ?? "");
  const parentId = String(formData.get("parentId") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();
  if (!postId || !body) return;

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return;

  // A reply's parent must belong to the same post.
  if (parentId) {
    const parent = await prisma.postComment.findUnique({
      where: { id: parentId },
    });
    if (!parent || parent.postId !== postId) return;
  }

  await prisma.postComment.create({
    data: { postId, authorId: userId, parentId, body: body.slice(0, MAX_BODY) },
  });
  refresh();
}

/**
 * Toggle a reaction on a post or comment. A member holds at most one reaction
 * per target: clicking the same kind removes it, a different kind switches it.
 */
export async function toggleReaction(args: {
  kind: string;
  postId?: string;
  commentId?: string;
}) {
  const session = await requireUser();
  const userId = session.user!.id;
  const { kind, postId, commentId } = args;
  if (!isReactionKind(kind)) return;
  if (!postId && !commentId) return;

  const where = postId ? { postId } : { commentId };
  const existing = await prisma.postReaction.findFirst({
    where: { userId, ...where },
  });

  if (!existing) {
    await prisma.postReaction.create({ data: { userId, kind, ...where } });
  } else if (existing.kind === kind) {
    await prisma.postReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.postReaction.update({
      where: { id: existing.id },
      data: { kind },
    });
  }
  refresh();
}

// --------------------------------------------------------------- moderation --

async function requireAdminUser() {
  const session = await requireUser();
  if (session.user!.role !== "ADMIN") return null;
  return session.user!.id;
}

/** Admin: hide/unhide a post (reversible soft-moderation). */
export async function setPostHidden(args: { postId: string; hidden: boolean }) {
  const admin = await requireAdminUser();
  if (!admin) return;
  await prisma.post.update({
    where: { id: args.postId },
    data: { hidden: args.hidden },
  });
  refresh();
}

/** Admin: permanently delete a post and its comments/reactions (cascade). */
export async function deletePost(args: { postId: string }) {
  const admin = await requireAdminUser();
  if (!admin) return;
  await prisma.post.delete({ where: { id: args.postId } });
  refresh();
}

/** Admin: hide/unhide a single comment. */
export async function setCommentHidden(args: {
  commentId: string;
  hidden: boolean;
}) {
  const admin = await requireAdminUser();
  if (!admin) return;
  await prisma.postComment.update({
    where: { id: args.commentId },
    data: { hidden: args.hidden },
  });
  refresh();
}

/** Admin: permanently delete a comment (and its replies, via cascade). */
export async function deleteComment(args: { commentId: string }) {
  const admin = await requireAdminUser();
  if (!admin) return;
  await prisma.postComment.delete({ where: { id: args.commentId } });
  refresh();
}
