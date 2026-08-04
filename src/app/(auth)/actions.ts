"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { registerSchema, loginSchema } from "@/lib/validation";
import { signIn, signOut } from "@/auth";

export type FormState = {
  ok: boolean;
  message?: string;
  autoApproved?: boolean;
  fieldErrors?: Record<string, string>;
};

export async function registerAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    audience: formData.get("audience"),
    agency: formData.get("agency"),
    state: formData.get("state"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  const { name, audience, agency, state, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      ok: false,
      fieldErrors: { email: "An account with this email already exists." },
    };
  }

  // Auto-approval policy:
  //   • Civilian investigators are auto-approved.
  //   • Law enforcement with a verified .gov email is auto-approved.
  //   • Law enforcement without a .gov email waits for manual admin review.
  const isGov = /\.gov(\.[a-z]{2})?$/i.test(email.split("@")[1] ?? "");
  const autoApprove = audience === "CIVILIAN" || (audience === "LE" && isGov);

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: {
      name,
      audience,
      agency,
      state,
      email,
      passwordHash,
      status: autoApprove ? "APPROVED" : "PENDING",
      approvedAt: autoApprove ? new Date() : null,
    },
  });

  return {
    ok: true,
    autoApproved: autoApprove,
    message: autoApprove
      ? "Your account is approved. You can sign in and begin your training right away."
      : "Registration received. An administrator will review and approve your access. You'll be able to sign in once approved.",
  };
}

export async function loginAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email and password." };
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  // Migrated / admin-created account that has never been activated. Tell them
  // plainly — otherwise a legacy user whose old LearnWorlds password no longer
  // works just sees "invalid password" and files a support ticket.
  if (user && !user.passwordHash) {
    return {
      ok: false,
      message:
        "This account hasn't been activated yet. Use the activation link that was emailed to you to set a password, or contact an administrator for a new link.",
    };
  }

  // Generic message for unknown email / bad password (no user enumeration).
  const hash = user?.passwordHash;
  if (!user || !hash || !(await verifyPassword(password, hash))) {
    return { ok: false, message: "Invalid email or password." };
  }

  // Precise, friendly messaging for approval gating.
  if (user.status === "PENDING") {
    return {
      ok: false,
      message:
        "Your account is awaiting administrator approval. You'll get access once it's reviewed.",
    };
  }
  if (user.status === "DENIED") {
    return {
      ok: false,
      message: "Your access request was not approved. Contact an administrator.",
    };
  }
  if (user.status === "SUSPENDED") {
    return {
      ok: false,
      message: "Your account is suspended. Contact an administrator.",
    };
  }

  // APPROVED — establish the session.
  await signIn("credentials", { email, password, redirect: false });

  redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
