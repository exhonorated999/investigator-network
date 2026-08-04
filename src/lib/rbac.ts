import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Session } from "next-auth";

/**
 * Accounts whose current password is a temporary credential they did not choose
 * (the shared migration password, or an admin-set one) are corralled into
 * /change-password. They hold a real session — otherwise they couldn't change
 * anything — but every authenticated area bounces them until they pick their
 * own password. /change-password itself must NOT call these helpers.
 */
function gatePasswordChange(session: Session): void {
  if (session.user.mustChangePassword) redirect("/change-password");
}

/** Require an authenticated session, else redirect to login. */
export async function requireUser(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  gatePasswordChange(session);
  return session;
}

/** Require an ADMIN session, else redirect. */
export async function requireAdmin(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  gatePasswordChange(session);
  return session;
}
