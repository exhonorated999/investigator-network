"use server";

import path from "path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { saveFile } from "@/lib/storage";
import { canAccessBoard, markBoardRead } from "@/lib/board";
import { sendBoardReplyEmail } from "@/lib/email";
import {
  boardEnabled,
  isBoardKind,
  BOARD_FILE_EXTENSIONS,
  BOARD_MAX_BODY,
  BOARD_MAX_FILE_BYTES,
} from "@/lib/board-config";

export interface BoardActionState {
  ok: boolean;
  error: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanUrl(raw: string): string | null | "invalid" {
  const v = raw.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "invalid";
    return u.toString();
  } catch {
    return "invalid";
  }
}

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/admin/moderation");
}

async function sessionUser() {
  const session = await requireUser();
  return {
    id: session.user!.id as string,
    role: session.user!.role as string | undefined,
  };
}

/** Create a post on a course's class board. */
export async function createBoardPost(
  _prev: BoardActionState,
  formData: FormData
): Promise<BoardActionState> {
  const user = await sessionUser();
  const slug = String(formData.get("slug") || "");
  const kind = String(formData.get("kind") || "");
  if (!boardEnabled(slug)) return { ok: false, error: "This course has no class board." };
  if (!isBoardKind(kind)) return { ok: false, error: "Choose a post type." };

  const course = await prisma.course.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!course || !(await canAccessBoard(user.id, user.role, course.id))) {
    return { ok: false, error: "You must be enrolled to post." };
  }

  const title = String(formData.get("title") || "").trim().slice(0, 200) || null;
  const body = String(formData.get("body") || "").trim().slice(0, BOARD_MAX_BODY);
  const agency = String(formData.get("agency") || "").trim().slice(0, 200) || null;
  const contactEmail =
    String(formData.get("contactEmail") || "").trim().slice(0, 200) || null;
  const link = cleanUrl(String(formData.get("linkUrl") || ""));
  if (link === "invalid") return { ok: false, error: "That link doesn't look like a valid web address." };

  const fileEntry = formData.get("file");
  const file =
    fileEntry && typeof fileEntry === "object" && "size" in fileEntry && fileEntry.size > 0
      ? (fileEntry as File)
      : null;

  // Per-type requirements.
  if (kind === "INTRO") {
    if (!title) return { ok: false, error: "Please enter your name." };
    if (!agency) return { ok: false, error: "Please enter your agency." };
    if (contactEmail && !EMAIL_RE.test(contactEmail)) {
      return { ok: false, error: "That contact email doesn't look right." };
    }
  } else if (kind === "QUESTION") {
    if (!body) return { ok: false, error: "Please write your question." };
  } else if (kind === "NEWS") {
    if (!title) return { ok: false, error: "Please add a headline." };
    if (!body && !link) return { ok: false, error: "Add a write-up or a link to the article." };
  } else if (kind === "RESOURCE") {
    if (!title) return { ok: false, error: "Please give the resource a title." };
    if (!link && !file) return { ok: false, error: "Add a link or attach a file." };
  }

  let fileId: string | null = null;
  if (file && kind === "RESOURCE") {
    if (file.size > BOARD_MAX_FILE_BYTES) {
      return { ok: false, error: "Files must be 10 MB or smaller." };
    }
    const ext = path.extname(file.name).toLowerCase();
    if (!BOARD_FILE_EXTENSIONS.includes(ext)) {
      return { ok: false, error: `File type ${ext || "(none)"} isn't allowed.` };
    }
    const stored = await saveFile(file, "board-file");
    const row = await prisma.fileUpload.create({
      data: {
        ownerUserId: user.id,
        path: stored.path,
        filename: stored.filename,
        mimeType: stored.mimeType || "application/octet-stream",
        sizeBytes: stored.sizeBytes,
        purpose: "board-file",
      },
    });
    fileId = row.id;
  }

  const post = await prisma.boardPost.create({
    data: {
      courseId: course.id,
      authorId: user.id,
      kind,
      title,
      body,
      linkUrl: kind === "INTRO" || kind === "QUESTION" ? null : link,
      agency: kind === "INTRO" ? agency : null,
      contactEmail: kind === "INTRO" ? contactEmail : null,
      fileId,
    },
  });
  // The author has obviously seen their own post — start their read marker
  // now so replies to it register as new for them.
  await markBoardRead(user.id, [post.id]);

  refresh();
  return { ok: true, error: null };
}

/** Reply to a post. Emails the post author (unless they replied themselves). */
export async function createBoardReply(
  postId: string,
  rawBody: string
): Promise<BoardActionState> {
  const user = await sessionUser();
  const body = String(rawBody || "").trim().slice(0, BOARD_MAX_BODY);
  if (!body) return { ok: false, error: "Write a reply first." };

  const post = await prisma.boardPost.findUnique({
    where: { id: postId },
    include: {
      course: { select: { id: true, slug: true, title: true } },
      author: { select: { id: true, name: true, email: true, status: true } },
    },
  });
  if (!post || post.hidden) return { ok: false, error: "That post is no longer available." };
  if (!(await canAccessBoard(user.id, user.role, post.courseId))) {
    return { ok: false, error: "You must be enrolled to reply." };
  }

  const reply = await prisma.boardReply.create({
    data: {
      postId,
      authorId: user.id,
      body,
      staff: user.role === "ADMIN",
    },
    include: { author: { select: { name: true } } },
  });
  await prisma.boardPost.update({
    where: { id: postId },
    data: { lastActivityAt: reply.createdAt },
  });
  await markBoardRead(user.id, [postId]);

  if (post.authorId !== user.id && post.author.status === "APPROVED") {
    try {
      await sendBoardReplyEmail(post.author.email, post.author.name, {
        courseTitle: post.course.title,
        postTitle: post.title?.trim() || post.body.trim().slice(0, 60) || "your post",
        replierName: reply.author.name,
        preview: body,
        path: `/courses/${post.course.slug}/board/${post.id}`,
      });
    } catch (err) {
      console.error("[board] reply email failed", err);
    }
  }

  refresh();
  revalidatePath(`/courses/${post.course.slug}/board/${post.id}`);
  return { ok: true, error: null };
}

/** Delete a post — its author or an admin. */
export async function deleteBoardPost(postId: string): Promise<void> {
  const user = await sessionUser();
  const post = await prisma.boardPost.findUnique({
    where: { id: postId },
    select: { authorId: true, fileId: true },
  });
  if (!post) return;
  if (post.authorId !== user.id && user.role !== "ADMIN") return;
  await prisma.boardPost.delete({ where: { id: postId } });
  if (post.fileId) {
    await prisma.fileUpload.delete({ where: { id: post.fileId } }).catch(() => {});
  }
  refresh();
}

/** Delete a reply — its author or an admin. */
export async function deleteBoardReply(replyId: string): Promise<void> {
  const user = await sessionUser();
  const reply = await prisma.boardReply.findUnique({
    where: { id: replyId },
    select: { authorId: true },
  });
  if (!reply) return;
  if (reply.authorId !== user.id && user.role !== "ADMIN") return;
  await prisma.boardReply.delete({ where: { id: replyId } });
  refresh();
}

/** Mark the given posts as viewed by the current user. */
export async function markBoardViewed(postIds: string[]): Promise<void> {
  const user = await sessionUser();
  if (!Array.isArray(postIds) || !postIds.length) return;
  await markBoardRead(user.id, postIds.slice(0, 500).map(String));
  revalidatePath("/dashboard");
}
