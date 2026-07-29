"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { registerSchema, loginSchema } from "@/lib/validation";
import { signIn, signOut } from "@/auth";

export type FormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function registerAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    agency: formData.get("agency"),
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

  const { name, agency, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      ok: false,
      fieldErrors: { email: "An account with this email already exists." },
    };
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: { name, agency, email, passwordHash },
  });

  return {
    ok: true,
    message:
      "Registration received. An administrator will review and approve your access. You'll be able to sign in once approved.",
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

  // Generic message for unknown email / bad password (no user enumeration).
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
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
