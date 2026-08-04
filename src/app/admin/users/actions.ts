"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { hashPassword } from "@/lib/password";
import { sendApprovalEmail, sendDenialEmail } from "@/lib/email";

function refresh() {
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export type CreateUserState = {
  ok: boolean;
  message?: string;
};

/**
 * Admin manual enrolment. Creating a user here bypasses the approval queue
 * entirely: the admin explicitly picks the audience (LE / Civilian) and the
 * account is APPROVED immediately, overriding the normal .gov / review gate.
 */
export async function createUser(
  _prev: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const session = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const agency = String(formData.get("agency") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const audienceRaw = String(formData.get("audience") ?? "").toUpperCase();
  const audience = audienceRaw === "CIVILIAN" ? "CIVILIAN" : "LE";
  const isAdminRole = formData.get("makeAdmin") != null;

  if (name.length < 2) return { ok: false, message: "Enter a full name." };
  if (!/^\S+@\S+\.\S+$/.test(email))
    return { ok: false, message: "Enter a valid email." };
  if (password.length < 8)
    return { ok: false, message: "Password must be at least 8 characters." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)
    return { ok: false, message: "An account with this email already exists." };

  // Only the super admin may mint new admins.
  if (isAdminRole) {
    const actor = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    });
    if (!actor?.isSuperAdmin)
      return {
        ok: false,
        message: "Only the super admin can grant the admin role.",
      };
  }

  await prisma.user.create({
    data: {
      name,
      email,
      agency,
      state,
      audience,
      role: isAdminRole ? "ADMIN" : "LEARNER",
      passwordHash: await hashPassword(password),
      status: "APPROVED",
      approvedAt: new Date(),
      approvedById: session.user.id,
    },
  });

  refresh();
  return {
    ok: true,
    message: `${name} created as ${
      audience === "CIVILIAN" ? "Civilian" : "Law Enforcement"
    } and approved.`,
  };
}

export async function approveUser(formData: FormData) {
  const session = await requireAdmin();
  const userId = String(formData.get("userId"));

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedById: session.user.id,
    },
  });

  await sendApprovalEmail(user.email, user.name);
  refresh();
}

export async function denyUser(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId"));

  const user = await prisma.user.update({
    where: { id: userId },
    data: { status: "DENIED" },
  });

  await sendDenialEmail(user.email, user.name);
  refresh();
}

/**
 * Decide whether `actor` is allowed to suspend/remove `target`.
 *  - Nobody may act on the super admin.
 *  - Nobody may act on themselves.
 *  - Acting on another ADMIN requires the actor to be the super admin.
 *  - Otherwise (a learner target) any admin may act.
 */
async function canManage(actorId: string, targetId: string): Promise<boolean> {
  if (actorId === targetId) return false;
  const [actor, target] = await Promise.all([
    prisma.user.findUnique({
      where: { id: actorId },
      select: { isSuperAdmin: true },
    }),
    prisma.user.findUnique({
      where: { id: targetId },
      select: { role: true, isSuperAdmin: true },
    }),
  ]);
  if (!actor || !target) return false;
  if (target.isSuperAdmin) return false;
  if (target.role === "ADMIN") return actor.isSuperAdmin;
  return true;
}

export async function suspendUser(formData: FormData) {
  const session = await requireAdmin();
  const userId = String(formData.get("userId"));
  if (!(await canManage(session.user.id, userId))) return;
  await prisma.user.update({
    where: { id: userId },
    data: { status: "SUSPENDED" },
  });
  refresh();
}

/**
 * Soft delete. Marks the account REMOVED: it can no longer log in and drops
 * out of directories/queues, but the row and all history are retained so the
 * account can be restored later. Admins can only be removed by the super admin,
 * and the super admin can never be removed.
 */
export async function removeUser(formData: FormData) {
  const session = await requireAdmin();
  const userId = String(formData.get("userId"));
  if (!(await canManage(session.user.id, userId))) return;

  await prisma.user.update({
    where: { id: userId },
    data: { status: "REMOVED" },
  });
  refresh();
}

/** Undo a soft delete — returns a REMOVED account to APPROVED access. */
export async function restoreUser(formData: FormData) {
  const session = await requireAdmin();
  const userId = String(formData.get("userId"));
  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedById: session.user.id,
    },
  });
  refresh();
}

export async function reactivateUser(formData: FormData) {
  const session = await requireAdmin();
  const userId = String(formData.get("userId"));
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedById: session.user.id,
    },
  });
  await sendApprovalEmail(user.email, user.name);
  refresh();
}

/** Enroll a user into a course from the admin user-detail page. */
export async function adminEnrollUser(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId"));
  const courseId = String(formData.get("courseId"));
  if (!userId || !courseId) return;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) return;

  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: {},
    create: { userId, courseId },
  });
  revalidatePath(`/admin/users/${userId}`);
  refresh();
}

/** Remove a user's enrollment (and their progress) in a course. */
export async function adminUnenrollUser(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId"));
  const courseId = String(formData.get("courseId"));
  if (!userId || !courseId) return;

  // Drop progress rows for this course's units so re-enrolling starts clean.
  const units = await prisma.unit.findMany({
    where: { section: { courseId } },
    select: { id: true },
  });
  const unitIds = units.map((u) => u.id);

  await prisma.$transaction([
    prisma.enrollment.deleteMany({ where: { userId, courseId } }),
    prisma.unitProgress.deleteMany({
      where: { userId, unitId: { in: unitIds } },
    }),
  ]);
  revalidatePath(`/admin/users/${userId}`);
  refresh();
}

export type ResetPwState = { ok: boolean; message?: string };

/**
 * Admin password reset. Follows the same authority rules as removal: a regular
 * admin may reset a learner's password, but resetting another admin's — or the
 * super admin's — password requires the super admin.
 */
export async function resetUserPassword(
  _prev: ResetPwState,
  formData: FormData
): Promise<ResetPwState> {
  const session = await requireAdmin();
  const userId = String(formData.get("userId"));
  const password = String(formData.get("password") ?? "");

  if (password.length < 8)
    return { ok: false, message: "Password must be at least 8 characters." };
  if (!(await canManage(session.user.id, userId)))
    return { ok: false, message: "You are not allowed to reset this password." };

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });
  return { ok: true, message: "Password reset. Share the new password securely." };
}
