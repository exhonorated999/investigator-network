import { prisma } from "@/lib/prisma";
import { startPreview } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q || "").trim();

  const learners = await prisma.user.findMany({
    where: {
      role: "LEARNER",
      status: "APPROVED",
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { agency: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 50,
    include: { _count: { select: { enrollments: true, certificates: true } } },
  });

  return (
    <div className="reveal max-w-3xl">
      <p className="eyebrow eyebrow-gold">// LEARNER PREVIEW</p>
      <h1 className="display-lg mt-2 text-foreground">View as learner</h1>
      <p className="mt-2 text-[15px] text-muted">
        Open the student experience as any approved learner. This is a read-only
        preview — a banner will let you exit back to admin.
      </p>

      <form className="mt-5" method="get">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by name, email, or agency…"
          className="field"
        />
      </form>

      {learners.length === 0 ? (
        <p className="panel mt-5 px-4 py-6 text-[15px] text-muted">
          No approved learners found.
        </p>
      ) : (
        <ul className="panel mt-5 divide-y divide-border overflow-hidden">
          {learners.map((u) => (
            <li key={u.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-foreground">{u.name}</p>
                <p className="truncate font-mono text-[11px] text-muted">
                  {u.agency} · {u.email}
                </p>
              </div>
              <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted sm:block">
                {u._count.enrollments} enrolled · {u._count.certificates} certs
              </span>
              <form action={startPreview}>
                <input type="hidden" name="userId" value={u.id} />
                <button className="btn btn-primary btn-sm shrink-0">
                  View as →
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
