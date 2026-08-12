import Link from "next/link";
import type { ReactNode } from "react";

/** Shared chrome for the smaller dashboard widgets. */
export function WidgetCard({
  number,
  eyebrow,
  title,
  count,
  tone = "cyan",
  children,
}: {
  number: string;
  eyebrow: string;
  title: string;
  count?: number;
  tone?: "cyan" | "gold";
  children: ReactNode;
}) {
  return (
    <section
      className={`panel rule-top ${tone === "gold" ? "rule-top-gold" : ""} flex h-full flex-col p-5`}
    >
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className={`eyebrow ${tone === "gold" ? "eyebrow-gold" : ""}`}>
            {number} / {eyebrow}
          </p>
          <h2 className="display-sm mt-2 text-[1.15rem]">{title}</h2>
        </div>
        {count != null ? (
          <span className="font-mono text-[11px] text-muted">
            {String(count).padStart(2, "0")}
          </span>
        ) : null}
      </header>
      <div className="mt-4 flex-1 min-h-0 max-h-[560px] overflow-y-auto pr-1">{children}</div>
    </section>
  );
}

export function WidgetEmpty({ children }: { children: ReactNode }) {
  return <p className="text-[15px] text-muted">{children}</p>;
}

export function CourseRow({
  href,
  title,
  meta,
  right,
}: {
  href: string;
  title: string;
  meta: string;
  right?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0 transition hover:bg-[rgba(0,180,216,0.05)]"
    >
      <span className="min-w-0">
        <span className="block truncate text-[15px] text-foreground group-hover:text-accent-bright">
          {title}
        </span>
        <span className="block font-mono text-[10px] uppercase tracking-wider text-muted">
          {meta}
        </span>
      </span>
      {right}
    </Link>
  );
}

/** Coming-soon placeholder used by the feeds that have no content source yet. */
export function WidgetStub({
  number,
  eyebrow,
  title,
  blurb,
}: {
  number: string;
  eyebrow: string;
  title: string;
  blurb: string;
}) {
  return (
    <section className="panel flex h-full flex-col border-dashed p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow eyebrow-muted">
            {number} / {eyebrow}
          </p>
          <h2 className="display-sm mt-2 text-[1.15rem] text-muted">{title}</h2>
        </div>
        <span className="tag-chip">// Standing up</span>
      </header>
      <p className="mt-4 flex-1 text-[15px] text-muted">{blurb}</p>
    </section>
  );
}
