"use server";

import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

export type ChangePasswordState = { ok: boolean; message?: string };

/** The shared bootstrap credential must never survive as a chosen password. */
const BANNED = ["ipreventcrime1!"];

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { ok: false, message: "Those passwords don't match." };
  }
  if (BANNED.includes(password.toLowerCase())) {
    return {
      ok: false,
      message:
        "That's the temporary password you were emailed. Choose something only you know.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, passwordHash: true, role: true },
  });
  if (!user) redirect("/login");

  // Reusing the temporary password under a different case/spacing is still the
  // temporary password. Catch it by comparing against the stored hash.
  if (user.passwordHash && (await verifyPassword(password, user.passwordHash))) {
    return {
      ok: false,
      message: "That's your current password. Choose a new one.",
    };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: false,
    },
  });

  // Re-authenticate so the JWT drops the mustChangePassword flag — otherwise the
  // stale token would keep bouncing them back here.
  await signIn("credentials", {
    email: user.email,
    password,
    redirect: false,
  });

  redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
}
