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

export async function suspendUser(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId"));
  await prisma.user.update({
    where: { id: userId },
    data: { status: "SUSPENDED" },
  });
  refresh();
}

/**
 * Soft delete. Marks the account REMOVED: it can no longer log in and drops
 * out of directories/queues, but the row and all history are retained so the
 * account can be restored later. Admins cannot be removed.
 */
export async function removeUser(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId"));

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!target || target.role === "ADMIN") return;

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
