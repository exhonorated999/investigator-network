import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28 flex flex-col items-center text-center">
            <Image
              src="/brand/logo.png"
              alt="Investigator Network"
              width={140}
              height={140}
              className="rounded-2xl"
              priority
            />
            <h1 className="mt-8 text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
              Investigator Network
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted">
              Professional training for investigators — live instructor-led
              sessions, on-demand courses, interactive notes, and certification.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Link
                href="/register"
                className="rounded-lg bg-accent px-6 py-3 font-semibold text-[#04212b] transition hover:bg-accent-strong"
              >
                Request access
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-border px-6 py-3 font-semibold text-foreground transition hover:border-accent"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted">
              Access is granted after administrator approval.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
