import Link from "next/link";
import type { Notification } from "@/lib/notifications";

const TONE: Record<Notification["tone"], string> = {
  cyan: "text-accent-bright",
  gold: "text-gold",
  success: "text-success",
  danger: "text-danger",
};

const ICON: Record<Notification["kind"], string> = {
  live: "📡",
  result: "✎",
  certificate: "🏅",
  grading: "⏳",
  release: "▣",
};

function when(n: Notification): string {
  if (!n.at) return "";
  const d = n.at;
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  if (n.kind === "live") {
    return `${date} · ${d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }
  return date;
}

export function NotificationsCard({ items }: { items: Notification[] }) {
  return (
    <section className="panel rule-top-gold rule-top flex h-full flex-col p-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow eyebrow-gold">02 / Dispatch</p>
          <h2 className="display-sm mt-2 text-[1.15rem]">Notifications</h2>
        </div>
        <span className="font-mono text-[11px] text-muted">
          {String(items.length).padStart(2, "0")}
        </span>
      </header>

      {items.length === 0 ? (
        <p className="mt-5 flex-1 text-[15px] text-muted">
          Nothing needs your attention. Live sessions, test results and new
          credentials will appear here.
        </p>
      ) : (
        <ul className="mt-4 flex-1 divide-y divide-border">
          {items.slice(0, 7).map((n) => (
            <li key={n.id}>
              <Link
                href={n.href}
                className="group flex items-start gap-3 py-3 transition hover:bg-[rgba(0,180,216,0.05)]"
              >
                <span className="mt-0.5 shrink-0 text-[13px] leading-none opacity-80">
                  {ICON[n.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block font-display text-[11px] font-bold uppercase tracking-[0.14em] ${TONE[n.tone]}`}
                  >
                    {n.title}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted group-hover:text-foreground">
                    {n.body}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted">
                  {when(n)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
