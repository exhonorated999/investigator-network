import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/site-header";
import {
  ProfileDetailsForm,
  ChangePasswordCard,
} from "./profile-forms";

export const metadata = { title: "Your profile — Investigator Network" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireUser();
  const isAdmin = session.user.role === "ADMIN";

  // Always edit the REAL signed-in account (never an impersonated preview),
  // and read fresh values straight from the database.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, agency: true, email: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <SiteHeader name={user.name} isAdmin={isAdmin} />

      <main className="mx-auto max-w-2xl px-5 pb-24 pt-8">
        <div className="reveal reveal-1">
          <Link
            href="/dashboard"
            className="eyebrow eyebrow-muted transition hover:text-accent-bright"
          >
            ← Back to my training
          </Link>
          <h1 className="display-lg mt-3">Your profile</h1>
          <p className="mt-2 text-sm text-muted">
            Manage your account details and password.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-6">
          <div className="reveal reveal-2">
            <ProfileDetailsForm
              name={user.name}
              agency={user.agency}
              email={user.email}
            />
          </div>
          <div className="reveal reveal-3">
            <ChangePasswordCard />
          </div>
        </div>
      </main>
    </div>
  );
}
