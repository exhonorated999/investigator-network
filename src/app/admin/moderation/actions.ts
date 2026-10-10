"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { createBoardReply } from "@/app/courses/[slug]/board/actions";

/**
 * Moderation actions for the community social feed. Each action requires an
 * admin session and revalidates both the admin moderation view and the learner
 * feed so changes are reflected immediately everywhere.
 */

// ------------------------------ Posts ------------------------------

/** Hide or unhide a post (soft moderation — reversible). */
export async function setPostHidden(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const hidden = formData.get("hidden") === "true";

  await prisma.post.update({
    where: { id },
    data: { hidden },
  });

  revalidatePath("/admin/moderation");
  revalidatePath("/community");
}

/** Permanently delete a post and all of its comments/reactions. */
export async function deletePost(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));

  await prisma.post.delete({ where: { id } });

  revalidatePath("/admin/moderation");
  revalidatePath("/community");
}

// ----------------------------- Replies -----------------------------

const MAX_BODY = 4000;

/**
 * Reply to a post (or thread a reply under a comment) directly from the
 * moderation console. Authored by the signed-in admin — no account switching.
 * Admins are audience-neutral, so either side's posts can be answered.
 */
export async function adminReply(formData: FormData) {
  const session = await requireAdmin();
  const authorId = session.user!.id;
  const postId = String(formData.get("postId") ?? "");
  const parentId = String(formData.get("parentId") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();
  if (!postId || !body) return;

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) return;
  if (parentId) {
    const parent = await prisma.postComment.findUnique({
      where: { id: parentId },
      select: { postId: true },
    });
    if (!parent || parent.postId !== postId) return;
  }

  await prisma.postComment.create({
    data: { postId, authorId, parentId, body: body.slice(0, MAX_BODY) },
  });

  revalidatePath("/admin/moderation");
  revalidatePath("/community");
  revalidatePath("/dashboard");
}

// ----------------------------- Comments -----------------------------

/** Hide or unhide a comment (soft moderation — reversible). */
export async function setCommentHidden(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const hidden = formData.get("hidden") === "true";

  await prisma.postComment.update({
    where: { id },
    data: { hidden },
  });

  revalidatePath("/admin/moderation");
  revalidatePath("/community");
}

/** Permanently delete a comment and its replies/reactions. */
export async function deleteComment(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));

  await prisma.postComment.delete({ where: { id } });

  revalidatePath("/admin/moderation");
  revalidatePath("/community");
}

// --------------------------- Class boards ---------------------------

function revalidateBoards() {
  revalidatePath("/admin/moderation");
  revalidatePath("/dashboard");
  revalidatePath("/courses", "layout");
}

export async function setBoardPostHidden(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const hidden = formData.get("hidden") === "true";
  await prisma.boardPost.update({ where: { id }, data: { hidden } });
  revalidateBoards();
}

export async function adminDeleteBoardPost(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const post = await prisma.boardPost.findUnique({ where: { id }, select: { fileId: true } });
  if (!post) return;
  await prisma.boardPost.delete({ where: { id } });
  if (post.fileId) {
    await prisma.fileUpload.delete({ where: { id: post.fileId } }).catch(() => {});
  }
  revalidateBoards();
}

export async function setBoardReplyHidden(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const hidden = formData.get("hidden") === "true";
  await prisma.boardReply.update({ where: { id }, data: { hidden } });
  revalidateBoards();
}

export async function adminDeleteBoardReply(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.boardReply.delete({ where: { id } });
  revalidateBoards();
}

/** Reply to a class-board post as the signed-in admin (Instructor badge). */
export async function adminBoardReply(formData: FormData) {
  await requireAdmin();
  const postId = String(formData.get("postId") ?? "");
  const body = String(formData.get("body") ?? "");
  if (!postId || !body.trim()) return;
  await createBoardReply(postId, body);
  revalidateBoards();
}
