import { auth } from "@/auth";
import { SignOutButton } from "@/components/sign-out";

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="font-semibold text-foreground">Investigator Network</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted">{user?.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome, {user?.name?.split(" ")[0]}
        </h1>
        <p className="mt-2 text-muted">
          {user?.agency} · Your training dashboard. Courses will appear here.
        </p>
      </main>
    </div>
  );
}
