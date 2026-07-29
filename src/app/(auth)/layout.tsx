import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (session?.user) {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/dashboard");
  }
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="flex flex-col items-center gap-3 mb-8">
          <Image
            src="/brand/logo.png"
            alt="Investigator Network"
            width={96}
            height={96}
            className="rounded-xl"
            priority
          />
          <span className="text-lg font-semibold tracking-wide text-foreground">
            Investigator Network
          </span>
        </Link>
        <div className="rounded-2xl border border-border bg-surface/80 backdrop-blur p-6 sm:p-8 shadow-xl">
          {children}
        </div>
      </div>
    </div>
  );
}
