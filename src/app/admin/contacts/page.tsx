import { prisma } from "@/lib/prisma";
import { addContact, importContacts, deleteContact, setContactStatus } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, string> = {
  SUBSCRIBED: "border-success/40 text-success bg-[rgba(74,222,128,0.08)]",
  UNSUBSCRIBED: "border-border text-muted",
  BOUNCED: "border-warning/40 text-warning bg-[rgba(244,162,97,0.08)]",
  COMPLAINED: "border-danger/40 text-danger bg-[rgba(239,68,68,0.08)]",
};

const LIST_CAP = 200;

export default async function ContactsAdminPage() {
  const [counts, contacts, total, suppressedCount] = await Promise.all([
    prisma.contact.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.contact.findMany({ orderBy: { createdAt: "desc" }, take: LIST_CAP }),
    prisma.contact.count(),
    prisma.suppression.count(),
  ]);

  const countBy = (s: string) =>
    counts.find((c) => c.status === s)?._count._all ?? 0;

  const cards = [
    { label: "Total contacts", value: total, tone: "text-foreground" },
    { label: "Subscribed", value: countBy("SUBSCRIBED"), tone: "text-success" },
    { label: "Unsubscribed", value: countBy("UNSUBSCRIBED"), tone: "text-muted" },
    { label: "Bounced", value: countBy("BOUNCED"), tone: "text-warning" },
    { label: "Suppressed (all)", value: suppressedCount, tone: "text-danger" },
  ];

  return (
    <div className="reveal">
      <p className="eyebrow eyebrow-gold">// CONTACTS</p>
      <h1 className="display-lg mt-2 text-foreground">Email contacts</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-muted">
        Non-member email addresses for campaigns. Members live in{" "}
        <a href="/admin/users" className="text-accent-bright hover:underline">
          Users
        </a>{" "}
        and are added to campaigns automatically — a contact that matches a
        member is skipped on import and never double-emailed.
      </p>

      {/* Summary */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="panel p-4">
            <p className={`font-display text-2xl font-black leading-none ${c.tone}`}>
              {c.value}
            </p>
            <p className="eyebrow eyebrow-muted mt-2">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Import */}
      <div className="panel rule-top mt-6 p-5">
        <p className="eyebrow eyebrow-muted">Import from CSV</p>
        <p className="mt-1 text-[13px] text-muted">
          Columns auto-detected by header: <code>email</code>, <code>name</code>,{" "}
          <code>company</code>. Headerless files are read as email in the first
          column. Existing contacts are updated, not duplicated.
        </p>
        <form action={importContacts} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">CSV file</span>
            <input type="file" name="file" required accept=".csv,text/csv" className="field" />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Source label (optional)</span>
            <input name="source" className="field" placeholder="csv:2026-Q3" />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary btn-sm">
              Import contacts
            </button>
          </div>
        </form>
      </div>

      {/* Manual add */}
      <div className="panel rule-top mt-6 p-5">
        <p className="eyebrow eyebrow-muted">Add one contact</p>
        <form action={addContact} className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Email</span>
            <input name="email" type="email" required className="field" placeholder="name@agency.gov" />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Name</span>
            <input name="name" className="field" />
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow eyebrow-muted">Company / agency</span>
            <input name="company" className="field" />
          </label>
          <div className="sm:col-span-3">
            <button type="submit" className="btn btn-ghost btn-sm">
              Add contact
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="mt-8">
        <div className="flex items-center gap-3">
          <h2 className="display-sm text-foreground">Contacts</h2>
          <span className="font-mono text-[11px] text-muted">
            showing {Math.min(total, LIST_CAP)} of {total}
          </span>
        </div>
        <div className="panel rule-top mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 eyebrow eyebrow-muted font-normal">Email</th>
                <th className="p-3 eyebrow eyebrow-muted font-normal">Name</th>
                <th className="p-3 eyebrow eyebrow-muted font-normal">Company</th>
                <th className="p-3 eyebrow eyebrow-muted font-normal">Status</th>
                <th className="p-3 text-right eyebrow eyebrow-muted font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-[14px] text-muted">
                    No contacts yet. Import a CSV to get started.
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id} className="border-b border-border/60">
                    <td className="p-3 text-[14px] text-foreground">{c.email}</td>
                    <td className="p-3 text-[14px] text-muted">{c.name || "—"}</td>
                    <td className="p-3 text-[14px] text-muted">{c.company || "—"}</td>
                    <td className="p-3">
                      <span
                        className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                          STATUS_CHIP[c.status]
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-2">
                        {c.status !== "SUBSCRIBED" ? (
                          <form action={setContactStatus}>
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="status" value="SUBSCRIBED" />
                            <button type="submit" className="btn btn-ghost btn-sm">
                              Resubscribe
                            </button>
                          </form>
                        ) : (
                          <form action={setContactStatus}>
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="status" value="UNSUBSCRIBED" />
                            <button type="submit" className="btn btn-ghost btn-sm">
                              Unsubscribe
                            </button>
                          </form>
                        )}
                        <form action={deleteContact}>
                          <input type="hidden" name="id" value={c.id} />
                          <button
                            type="submit"
                            className="btn btn-ghost btn-sm border-danger/40 text-danger hover:border-danger hover:bg-[rgba(239,68,68,0.08)] hover:text-danger"
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
