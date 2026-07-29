import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Session } from "next-auth";

/** Require an authenticated session, else redirect to login. */
export async function requireUser(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

/** Require an ADMIN session, else redirect. */
export async function requireAdmin(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  return session;
}
