import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma, UserStatus } from "@prisma/client";
import {
  approveUser,
  denyUser,
  suspendUser,
  reactivateUser,
} from "./actions";

export const dynamic = "force-dynamic";

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "SUSPENDED", label: "Suspended" },
  { key: "DENIED", label: "Denied" },
  { key: "ALL", label: "All" },
];

const badgeClass: Record<UserStatus, string> = {
  PENDING: "bg-warning/15 text-warning border-warning/30",
  APPROVED: "bg-success/15 text-success border-success/30",
  DENIED: "bg-danger/15 text-danger border-danger/30",
  SUSPENDED: "bg-muted/15 text-muted border-muted/30",
};

function ActionButton({
  action,
  userId,
  label,
  variant = "default",
}: {
  action: (formData: FormData) => void;
  userId: string;
  label: string;
  variant?: "primary" | "danger" | "default";
}) {
  const styles =
    variant === "primary"
      ? "bg-accent text-[#04212b] hover:bg-accent-strong"
      : variant === "danger"
      ? "border border-danger/40 text-danger hover:bg-danger/10"
      : "border border-border text-muted hover:text-foreground hover:border-accent";
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${styles}`}
      >
        {label}
      </button>
    </form>
  );
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status = "PENDING", q = "" } = await searchParams;

  const where: Prisma.UserWhereInput = {};
  if (status !== "ALL") where.status = status as UserStatus;
  if (q.trim()) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { agency: { contains: q, mode: "insensitive" } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const buildHref = (s: string) =>
    `/admin/users?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">
        Users &amp; approvals
      </h1>
      <p className="mt-1 text-muted">
        Review registrations and manage learner access.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => {
          const active = t.key === status;
          return (
            <Link
              key={t.key}
              href={buildHref(t.key)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                active
                  ? "bg-accent/15 text-accent"
                  : "border border-border text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
        <form action="/admin/users" className="ml-auto flex gap-2">
          <input type="hidden" name="status" value={status} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, email, agency"
            className="w-56 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
          >
            Search
          </button>
        </form>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Agency</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Registered</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3 text-foreground">{u.name}</td>
                  <td className="px-4 py-3 text-muted">{u.agency}</td>
                  <td className="px-4 py-3 text-muted">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${badgeClass[u.status]}`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {u.createdAt.toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {u.status === "PENDING" && (
                        <>
                          <ActionButton
                            action={approveUser}
                            userId={u.id}
                            label="Approve"
                            variant="primary"
                          />
                          <ActionButton
                            action={denyUser}
                            userId={u.id}
                            label="Deny"
                            variant="danger"
                          />
                        </>
                      )}
                      {u.status === "APPROVED" && u.role !== "ADMIN" && (
                        <ActionButton
                          action={suspendUser}
                          userId={u.id}
                          label="Suspend"
                          variant="danger"
                        />
                      )}
                      {(u.status === "SUSPENDED" || u.status === "DENIED") && (
                        <ActionButton
                          action={reactivateUser}
                          userId={u.id}
                          label="Approve access"
                          variant="primary"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
