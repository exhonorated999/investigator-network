"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/users", label: "Users & approvals" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/news", label: "Newsroom" },
  { href: "/admin/grading", label: "Grading" },
  { href: "/admin/moderation", label: "Moderation" },
  { href: "/admin/preview", label: "View as learner" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
      <Link href="/admin" className="mb-0 mr-3 flex shrink-0 items-center gap-2 md:mb-6 md:mr-0">
        <Image
          src="/brand/logo.png"
          alt="Investigator Network"
          width={36}
          height={36}
          className="rounded-md"
        />
        <span className="hidden leading-none md:inline">
          <span className="eyebrow eyebrow-muted block text-[8px]">Intellect LE</span>
          <span className="display-sm block text-[13px] text-foreground">Investigator Network</span>
        </span>
      </Link>
      {links.map((l) => {
        const active = l.exact
          ? pathname === l.href
          : pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 whitespace-nowrap border-l-2 px-3 py-2 font-display text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
              active
                ? "border-accent-bright bg-[rgba(0,180,216,0.08)] text-accent-bright"
                : "border-transparent text-muted hover:border-border-strong hover:text-accent-bright"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
