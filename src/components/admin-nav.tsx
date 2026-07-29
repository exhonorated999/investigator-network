"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/users", label: "Users & approvals" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/grading", label: "Grading" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
      <Link href="/admin" className="mb-0 mr-2 flex shrink-0 items-center gap-2 md:mb-6 md:mr-0">
        <Image
          src="/brand/logo.png"
          alt="Investigator Network"
          width={36}
          height={36}
          className="rounded-md"
        />
        <span className="hidden text-sm font-semibold text-foreground md:inline">
          Investigator Network
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
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-accent/15 text-accent"
                : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
