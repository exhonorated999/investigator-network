import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import type { Prisma, UserStatus, Audience } from "@/generated/prisma";
import { AUDIENCE_SHORT } from "@/lib/audience";
import { CreateUserForm } from "./create-user-form";
import { ConfirmSubmit } from "./confirm-button";
import {
  approveUser,
  denyUser,
  suspendUser,
  reactivateUser,
  removeUser,
  restoreUser,
} from "./actions";

export const dynamic = "force-dynamic";

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "SUSPENDED", label: "Suspended" },
  { key: "DENIED", label: "Denied" },
  { key: "REMOVED", label: "Removed" },
  { key: "ALL", label: "All" },
];

const badgeClass: Record<UserStatus, string> = {
  PENDING: "border-gold/40 text-gold bg-[rgba(244,162,97,0.08)]",
  APPROVED: "border-success/40 text-success bg-[rgba(74,222,128,0.08)]",
  DENIED: "border-danger/40 text-danger bg-[rgba(239,68,68,0.08)]",
  SUSPENDED: "border-muted/40 text-muted bg-[rgba(136,153,170,0.08)]",
  REMOVED: "border-danger/40 text-danger bg-[rgba(239,68,68,0.12)]",
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
      ? "btn btn-primary btn-sm"
      : variant === "danger"
      ? "btn btn-ghost btn-sm border-danger/40 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)] hover:text-danger"
      : "btn btn-ghost btn-sm";
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" className={styles}>
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

  const session = await requireAdmin();
  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isSuperAdmin: true },
  });
  const actorIsSuper = actor?.isSuperAdmin ?? false;
  const actorId = actor?.id ?? "";

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

  // Courses offered in the "create user" enrol picker.
  const courses = await prisma.course.findMany({
    orderBy: [{ status: "asc" }, { title: "asc" }],
    select: { id: true, title: true, status: true, isPrivate: true },
  });

  const buildHref = (s: string) =>
    `/admin/users?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div className="reveal">
      <p className="eyebrow eyebrow-gold">// ACCESS CONTROL</p>
      <h1 className="display-lg mt-2 text-foreground">Users &amp; Approvals</h1>
      <p className="mt-2 text-[15px] text-muted">
        Review registrations and manage learner access.
      </p>

      <div className="mt-6">
        <CreateUserForm canGrantAdmin={actorIsSuper} courses={courses} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => {
          const active = t.key === status;
          return (
            <Link
              key={t.key}
              href={buildHref(t.key)}
              className={`shrink-0 border px-3 py-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.18em] transition ${
                active
                  ? "border-accent-bright bg-[rgba(0,180,216,0.08)] text-accent-bright"
                  : "border-border text-muted hover:border-border-strong hover:text-accent-bright"
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
            className="field w-48 sm:w-56"
          />
          <button
            type="submit"
            className="btn btn-ghost btn-sm"
          >
            Search
          </button>
        </form>
      </div>

      <div className="panel mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left">
            <tr>
              <th className="eyebrow eyebrow-muted px-4 py-3">Name</th>
              <th className="eyebrow eyebrow-muted px-4 py-3">Side</th>
              <th className="eyebrow eyebrow-muted px-4 py-3">Agency</th>
              <th className="eyebrow eyebrow-muted px-4 py-3">Email</th>
              <th className="eyebrow eyebrow-muted px-4 py-3">Status</th>
              <th className="eyebrow eyebrow-muted px-4 py-3">Registered</th>
              <th className="eyebrow eyebrow-muted px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                // A learner is manageable by any admin; an admin is manageable
                // only by the super admin; the super admin and self are never
                // manageable.
                const manageable =
                  u.id !== actorId &&
                  !u.isSuperAdmin &&
                  (u.role !== "ADMIN" || actorIsSuper);
                return (
                <tr key={u.id} className="border-t border-border transition hover:bg-[rgba(0,180,216,0.03)]">
                  <td className="px-4 py-3 text-foreground">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="font-medium hover:text-accent-bright hover:underline"
                    >
                      {u.name}
                    </Link>
                    {u.role === "ADMIN" && (
                      <span
                        className={`mt-1 inline-block border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${
                          u.isSuperAdmin
                            ? "border-gold/50 text-gold bg-[rgba(244,162,97,0.10)]"
                            : "border-accent-bright/40 text-accent-bright bg-[rgba(0,180,216,0.08)]"
                        }`}
                      >
                        {u.isSuperAdmin ? "Super Admin" : "Admin"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
                        u.audience === "CIVILIAN"
                          ? "border-purple/40 text-purple bg-[rgba(168,85,247,0.08)]"
                          : "border-accent-bright/40 text-accent-bright bg-[rgba(0,180,216,0.06)]"
                      }`}
                    >
                      {AUDIENCE_SHORT[u.audience as Audience]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{u.agency}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-muted">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${badgeClass[u.status]}`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted">
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
                      {u.status === "APPROVED" && manageable && (
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
                      {u.status === "REMOVED" ? (
                        <ActionButton
                          action={restoreUser}
                          userId={u.id}
                          label="Restore"
                          variant="primary"
                        />
                      ) : manageable ? (
                        <form action={removeUser}>
                          <input type="hidden" name="userId" value={u.id} />
                          <ConfirmSubmit
                            label="Remove"
                            message={`Remove ${u.name}? They will lose access immediately. You can restore the account later from the Removed tab.`}
                            className="btn btn-ghost btn-sm border-danger/40 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)] hover:text-danger"
                          />
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
