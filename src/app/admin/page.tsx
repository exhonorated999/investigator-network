import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminHome() {
  const [pending, learners, courses] = await Promise.all([
    prisma.user.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { role: "LEARNER", status: "APPROVED" } }),
    prisma.course.count(),
  ]);

  const stats = [
    {
      label: "Pending approvals",
      value: pending,
      href: "/admin/users?status=PENDING",
      accent: true,
    },
    { label: "Approved learners", value: learners, href: "/admin/users?status=APPROVED" },
    { label: "Courses", value: courses, href: "/admin/courses" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Admin dashboard</h1>
      <p className="mt-1 text-muted">
        Approvals, courses, and grading — the things you actually do.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`rounded-2xl border bg-surface p-6 transition hover:border-accent ${
              s.accent && s.value > 0
                ? "border-accent/50 ring-1 ring-accent/20"
                : "border-border"
            }`}
          >
            <div className="text-3xl font-semibold text-foreground">{s.value}</div>
            <div className="mt-1 text-sm text-muted">{s.label}</div>
          </Link>
        ))}
      </div>

      {pending > 0 ? (
        <div className="mt-8 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
          {pending} {pending === 1 ? "person is" : "people are"} waiting for
          access.{" "}
          <Link href="/admin/users?status=PENDING" className="underline">
            Review now
          </Link>
        </div>
      ) : null}
    </div>
  );
}
