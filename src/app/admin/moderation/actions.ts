"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";

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
