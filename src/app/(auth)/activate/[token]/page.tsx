import Link from "next/link";
import { lookupInviteToken } from "@/lib/invite";
import { ActivateForm } from "./activate-form";

export const metadata = {
  title: "Activate your account — Investigator Network",
};

/** Never let an activation link get indexed or cached anywhere. */
export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  unknown:
    "This activation link isn't valid. It may have been mistyped, or truncated by an email client — try copying the whole link.",
  used: "This link has already been used. Your account is set up, so just sign in.",
  expired:
    "This activation link has expired. Ask an administrator to send you a new one.",
  inactive:
    "This account isn't active. Contact an administrator for help getting access.",
};

export default async function ActivatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const found = await lookupInviteToken(decodeURIComponent(token));

  if (!found.ok) {
    return (
      <div>
        <p className="eyebrow eyebrow-gold">// Activation</p>
        <h1 className="display-lg mt-2">Link unavailable</h1>
        <div className="mt-5 border border-danger/40 bg-[rgba(239,68,68,0.08)] px-4 py-3">
          <p className="font-mono text-xs text-danger">
            <span className="opacity-60">// </span>
            {REASONS[found.reason]}
          </p>
        </div>
        <p className="mt-6 text-center font-mono text-xs text-muted">
          <Link
            href="/login"
            className="text-accent-bright transition hover:text-accent"
          >
            Go to sign in →
          </Link>
        </p>
      </div>
    );
  }

  const isReset = found.purpose === "PASSWORD_RESET" || found.user.hasPassword;

  return (
    <div>
      <p className="eyebrow eyebrow-gold">
        // {isReset ? "Password reset" : "Account activation"}
      </p>
      <h1 className="display-lg mt-2">
        {isReset ? "Set a new password" : "Welcome aboard"}
      </h1>
      <p className="mt-3 text-sm text-muted">
        {isReset ? (
          <>Choose a new password for {found.user.email}.</>
        ) : (
          <>
            Your account is ready, {found.user.name.split(" ")[0]}. Set a password
            for <span className="text-foreground">{found.user.email}</span> and
            you&apos;ll be signed straight in.
          </>
        )}
      </p>

      <ActivateForm token={token} isReset={isReset} />
    </div>
  );
}
