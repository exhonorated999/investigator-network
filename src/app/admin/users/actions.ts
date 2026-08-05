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

  const created = await prisma.user.create({
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

  // Optional: enroll the new account into one or more courses immediately.
  const courseIds = formData
    .getAll("courseIds")
    .map((v) => String(v))
    .filter(Boolean);
  let enrolledCount = 0;
  if (courseIds.length) {
    const valid = await prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true },
    });
    if (valid.length) {
      const res = await prisma.enrollment.createMany({
        data: valid.map((c) => ({ userId: created.id, courseId: c.id })),
        skipDuplicates: true,
      });
      enrolledCount = res.count;
    }
  }

  refresh();
  return {
    ok: true,
    message: `${name} created as ${
      audience === "CIVILIAN" ? "Civilian" : "Law Enforcement"
    } and approved${
      enrolledCount ? ` · enrolled in ${enrolledCount} course${enrolledCount === 1 ? "" : "s"}` : ""
    }.`,
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

export type RoleState = { ok: boolean; message?: string };

/**
 * Change a user's role / side. The admin console exposes three choices:
 *   - "LE"       → Learner on the Law-Enforcement side
 *   - "CIVILIAN" → Learner on the Civilian side
 *   - "ADMIN"    → Admin (audience-neutral; side is left untouched)
 *
 * Authority rules mirror the rest of this module: the super admin is
 * untouchable, you cannot change your own role here, and granting OR revoking
 * the admin role requires the super admin.
 */
export async function setUserRole(
  _prev: RoleState,
  formData: FormData
): Promise<RoleState> {
  const session = await requireAdmin();
  const userId = String(formData.get("userId"));
  const role = String(formData.get("role"));

  if (!["LE", "CIVILIAN", "ADMIN"].includes(role))
    return { ok: false, message: "Pick a valid role." };

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, audience: true, isSuperAdmin: true },
  });
  if (!target) return { ok: false, message: "User not found." };
  if (target.isSuperAdmin)
    return { ok: false, message: "The super admin's role cannot be changed." };
  if (userId === session.user.id)
    return { ok: false, message: "You cannot change your own role." };

  // Granting admin, or demoting an existing admin, is super-admin-only.
  const touchesAdmin = role === "ADMIN" || target.role === "ADMIN";
  if (touchesAdmin) {
    const actor = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    });
    if (!actor?.isSuperAdmin)
      return {
        ok: false,
        message: "Only the super admin can grant or revoke the admin role.",
      };
  }

  const data =
    role === "ADMIN"
      ? { role: "ADMIN" as const }
      : role === "CIVILIAN"
      ? { role: "LEARNER" as const, audience: "CIVILIAN" as const }
      : { role: "LEARNER" as const, audience: "LE" as const };

  await prisma.user.update({ where: { id: userId }, data });
  revalidatePath(`/admin/users/${userId}`);
  refresh();

  const label =
    role === "ADMIN" ? "Admin" : role === "CIVILIAN" ? "Civilian" : "Law Enforcement";
  return { ok: true, message: `Role updated to ${label}.` };
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

/** Enroll a user into several courses at once (multi-select on the detail page). */
export async function adminEnrollUserMany(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId"));
  const courseIds = formData
    .getAll("courseIds")
    .map((v) => String(v))
    .filter(Boolean);
  if (!userId || courseIds.length === 0) return;

  const valid = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    select: { id: true },
  });
  if (valid.length === 0) return;

  await prisma.enrollment.createMany({
    data: valid.map((c) => ({ userId, courseId: c.id })),
    skipDuplicates: true,
  });
  revalidatePath(`/admin/users/${userId}`);
  refresh();
}
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
