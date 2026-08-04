"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { redeemInviteToken } from "@/lib/invite";
import { signIn } from "@/auth";

export type ActivateState = {
  ok: boolean;
  message?: string;
};

/**
 * Redeem an activation / reset link: set a password, then drop the user straight
 * into the platform. Signing them in here is deliberate — making someone who
 * just proved control of their mailbox retype a password they set ten seconds
 * ago is the kind of friction that generates support email.
 */
export async function activateAction(
  _prev: ActivateState,
  formData: FormData
): Promise<ActivateState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) return { ok: false, message: "Missing activation token." };
  if (password.length < 8)
    return { ok: false, message: "Password must be at least 8 characters." };
  if (password !== confirm)
    return { ok: false, message: "The two passwords do not match." };

  const result = await redeemInviteToken(token, password);
  if (!result.ok) return { ok: false, message: result.message };

  const user = await prisma.user.findUnique({
    where: { email: result.email },
    select: { role: true, status: true },
  });

  // An account still awaiting review keeps its password but not a session.
  if (user?.status !== "APPROVED") {
    return {
      ok: false,
      message:
        "Your password is set, but the account is still awaiting administrator approval. You'll be able to sign in once it's reviewed.",
    };
  }

  await signIn("credentials", {
    email: result.email,
    password,
    redirect: false,
  });

  redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
}
