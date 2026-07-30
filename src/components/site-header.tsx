import Link from "next/link";
import Image from "next/image";
import { SignOutButton } from "@/components/sign-out";

export function SiteHeader({
  name,
  isAdmin,
}: {
  name?: string | null;
  isAdmin?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[rgba(13,15,20,0.82)] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/dashboard" className="group flex items-center gap-3">
          <Image
            src="/brand/logo.png"
            alt="Investigator Network"
            width={38}
            height={38}
            className="transition group-hover:drop-shadow-[0_0_10px_rgba(0,180,216,0.7)]"
          />
          <span className="leading-none">
            <span className="eyebrow eyebrow-muted block text-[9px]">
              Intellect LE
            </span>
            <span className="display-sm block text-[15px] text-foreground group-hover:text-accent-bright">
              Investigator Network
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-5">
          <Link
            href="/dashboard"
            className="eyebrow eyebrow-muted hidden transition hover:text-accent-bright sm:block"
          >
            My Training
          </Link>
          <Link
            href="/news"
            className="eyebrow eyebrow-muted hidden transition hover:text-accent-bright sm:block"
          >
            Feed
          </Link>
          {isAdmin ? (
            <Link
              href="/admin"
              className="eyebrow transition hover:text-accent-bright"
            >
              Admin
            </Link>
          ) : null}
          {name ? (
            <span className="hidden items-center gap-2 border-l border-border pl-5 lg:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border-strong bg-[rgba(0,180,216,0.1)] font-mono text-[11px] text-accent-bright">
                {name.trim().charAt(0).toUpperCase()}
              </span>
              <span className="text-sm text-muted">{name}</span>
            </span>
          ) : null}
          <SignOutButton />
        </nav>
      </div>
    </header>
  );
}
