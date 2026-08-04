import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "Change your password — Investigator Network" };
export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  // Deliberately uses auth() rather than requireUser() — requireUser redirects
  // mustChangePassword sessions *here*, so calling it would loop.
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Someone who already chose a password has no business on this screen.
  if (!session.user.mustChangePassword) {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/dashboard");
  }

  const first = session.user.name?.trim().split(" ")[0];

  return (
    <div>
      <p className="eyebrow eyebrow-gold">// Security</p>
      <h1 className="display-lg mt-2">Choose your password</h1>
      <p className="mt-3 text-sm text-muted">
        {first ? `Welcome back, ${first}. ` : ""}You signed in with the temporary
        password we emailed you. Set a private password for{" "}
        <span className="text-foreground">{session.user.email}</span> to finish
        moving your account onto the new platform.
      </p>
      <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted">
        <span className="opacity-60">// </span>
        The temporary password was shared with everyone who moved over. Until you
        replace it, your account isn&apos;t private.
      </p>

      <ChangePasswordForm />
    </div>
  );
}
