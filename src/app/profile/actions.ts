"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, updateSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

export type ProfileState = { ok: boolean; message?: string };

/**
 * Update the signed-in user's display name and agency.
 *
 * Mutations always run as the REAL signed-in user, never an impersonated
 * preview account — we resolve the id from the session directly.
 */
export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const agency = String(formData.get("agency") ?? "").trim();

  if (name.length < 2) {
    return { ok: false, message: "Please enter your display name." };
  }
  if (name.length > 80) {
    return { ok: false, message: "Display name is too long (80 characters max)." };
  }
  if (agency.length > 120) {
    return { ok: false, message: "Agency is too long (120 characters max)." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name, agency },
  });

  // Refresh the cached JWT so the header, dashboard and certificates reflect
  // the new values without forcing a re-login.
  await updateSession({ user: { name, agency } });

  revalidatePath("/profile");
  revalidatePath("/dashboard");

  return { ok: true, message: "Profile updated." };
}

/** The shared bootstrap credential must never survive as a chosen password. */
const BANNED = ["ipreventcrime1!"];

/**
 * Change password for an already-activated user who knows their current one.
 * (Distinct from the /change-password bootstrap flow, which has no "current"
 * check because those users are on a shared temporary password.)
 */
export async function updatePasswordAction(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { ok: false, message: "New password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { ok: false, message: "Those passwords don't match." };
  }
  if (BANNED.includes(password.toLowerCase())) {
    return {
      ok: false,
      message: "Choose a password that only you know.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user) redirect("/login");

  if (!user.passwordHash) {
    return {
      ok: false,
      message: "Your account has no password set. Use the activation link instead.",
    };
  }
  if (!(await verifyPassword(current, user.passwordHash))) {
    return { ok: false, message: "Your current password is incorrect." };
  }
  if (await verifyPassword(password, user.passwordHash)) {
    return { ok: false, message: "That's already your current password." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: await hashPassword(password), mustChangePassword: false },
  });

  return { ok: true, message: "Password changed." };
}
