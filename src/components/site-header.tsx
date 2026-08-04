import Link from "next/link";
import Image from "next/image";
import { SignOutButton } from "@/components/sign-out";
import { ThemeToggle } from "@/components/theme-toggle";
import { getViewerUser } from "@/lib/viewer";
import { loadUnreadCount } from "@/lib/messages";

export async function SiteHeader({
  name,
  isAdmin,
}: {
  name?: string | null;
  isAdmin?: boolean;
}) {
  // Self-contained unread badge so every page's header stays in sync without
  // each caller having to thread the count through.
  const viewer = await getViewerUser();
  const unread = viewer ? await loadUnreadCount(viewer.id) : 0;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[var(--header-bg)] backdrop-blur-md">
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

        {viewer?.audience === "CIVILIAN" ? (
          <span className="hidden shrink-0 items-center gap-1.5 border border-accent/40 bg-[rgba(16,185,129,0.08)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-accent-bright sm:inline-flex">
            ◆ Private Investigator
          </span>
        ) : null}

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
          <Link
            href="/community"
            className="eyebrow eyebrow-muted hidden transition hover:text-accent-bright sm:block"
          >
            Community
          </Link>
          <Link
            href="/messages"
            className="eyebrow eyebrow-muted relative hidden transition hover:text-accent-bright sm:block"
          >
            Messages
            {unread > 0 ? (
              <span className="absolute -right-3 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-accent-bright px-1 font-mono text-[10px] font-bold leading-none text-void">
                {unread}
              </span>
            ) : null}
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
          <ThemeToggle />
          <SignOutButton />
        </nav>
      </div>
    </header>
  );
}
