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
        <header className="flex items-center justify-between border-b border-border bg-[rgba(13,15,20,0.82)] px-5 py-3 backdrop-blur-md md:px-6">
          <span className="tag-chip tag-chip-cyan">// ADMIN CONSOLE</span>
          <div className="flex items-center gap-4">
            <span className="hidden items-center gap-2 sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border-strong bg-[rgba(0,180,216,0.1)] font-mono text-[11px] text-accent-bright">
                {session.user.name?.trim().charAt(0).toUpperCase() ?? "A"}
              </span>
              <span className="text-sm text-muted">{session.user.name}</span>
            </span>
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 px-5 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
