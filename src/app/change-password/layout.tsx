import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Same shell as the (auth) group, but deliberately NOT inside it — that layout
 * redirects any signed-in user away, and everyone landing here is signed in.
 */
export default function ChangePasswordLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-8 flex flex-col items-center gap-3 reveal reveal-1"
        >
          <Image
            src="/brand/logo.png"
            alt="Investigator Network"
            width={80}
            height={80}
            className="transition drop-shadow-[0_0_18px_rgba(0,180,216,0.35)]"
            priority
          />
          <span className="text-center leading-none">
            <span className="eyebrow eyebrow-muted block text-[9px]">
              Intellect LE
            </span>
            <span className="display-sm mt-1 block text-[15px] text-foreground">
              Investigator Network
            </span>
          </span>
        </Link>
        <div className="bracket panel rule-top relative p-6 sm:p-8 reveal reveal-2">
          {children}
        </div>
        <p className="mt-6 text-center font-mono text-[10px] text-muted reveal reveal-3">
          <span className="opacity-60">// </span>
          SECURE TERMINAL — AUTHORIZED PERSONNEL ONLY
        </p>
      </div>
    </div>
  );
}
