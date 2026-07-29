import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/rbac";
import { AdminNav } from "@/components/admin-nav";
import { SignOutButton } from "@/components/sign-out";

// Admin-only area: require an authenticated ADMIN session, then render the shell.
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireAdmin();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-border bg-surface p-4 md:border-b-0 md:border-r md:min-h-screen">
        <AdminNav />
      </aside>
      <div className="flex flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface/60 px-6 py-3">
          <span className="text-sm text-muted">Admin</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted">{session.user.name}</span>
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
