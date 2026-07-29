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
    <header className="border-b border-border bg-surface/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Image src="/brand/logo.png" alt="Investigator Network" width={32} height={32} />
          <span className="font-semibold text-foreground">Investigator Network</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
            My training
          </Link>
          {isAdmin ? (
            <Link href="/admin" className="text-sm text-accent hover:underline">
              Admin
            </Link>
          ) : null}
          {name ? <span className="text-sm text-muted">{name}</span> : null}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
