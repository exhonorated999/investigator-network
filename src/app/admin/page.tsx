import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/sign-out";

export default async function AdminHome() {
  const session = await auth();
  const user = session?.user;

  const [pending, learners, courses] = await Promise.all([
    prisma.user.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { role: "LEARNER", status: "APPROVED" } }),
    prisma.course.count(),
  ]);

  const stats = [
    { label: "Pending approvals", value: pending, accent: true },
    { label: "Approved learners", value: learners },
    { label: "Courses", value: courses },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="font-semibold text-foreground">
            Investigator Network · Admin
          </span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted">{user?.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-foreground">Admin dashboard</h1>
        <p className="mt-1 text-muted">
          Approvals, courses, and grading — the things you actually do.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`rounded-2xl border bg-surface p-6 ${
                s.accent && s.value > 0
                  ? "border-accent/50 ring-1 ring-accent/20"
                  : "border-border"
              }`}
            >
              <div className="text-3xl font-semibold text-foreground">
                {s.value}
              </div>
              <div className="mt-1 text-sm text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
