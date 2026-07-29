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
    <nav className="flex flex-col gap-1">
      <Link href="/admin" className="mb-6 flex items-center gap-2">
        <Image
          src="/brand/logo.png"
          alt="Investigator Network"
          width={36}
          height={36}
          className="rounded-md"
        />
        <span className="text-sm font-semibold text-foreground">
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
            className={`rounded-lg px-3 py-2 text-sm transition ${
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
