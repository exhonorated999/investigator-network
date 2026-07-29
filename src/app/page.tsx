import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        {/* ----------------------------------------------------------- hero */}
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
            <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              {/* Left: copy + CTAs */}
              <div className="reveal reveal-1">
                <span className="pill">Secure training portal</span>
                <h1 className="display-xl mt-6">
                  Investigator
                  <br />
                  <span className="glow-text">Network</span>
                </h1>
                <p className="mt-5 max-w-lg text-lg text-muted">
                  Professional training for investigators — live instructor-led
                  sessions, on-demand video, interactive assessments, and
                  certification. Built for agencies that demand rigor.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/register" className="btn btn-primary">
                    Request access
                  </Link>
                  <Link href="/login" className="btn btn-ghost">
                    Sign in
                  </Link>
                </div>
                <p className="mt-5 font-mono text-[11px] text-muted">
                  <span className="opacity-60">// </span>
                  Access is granted after administrator approval.
                </p>
              </div>

              {/* Right: brand banner with brackets + scanlines */}
              <div className="bracket scanlines relative overflow-hidden border border-border reveal reveal-2">
                <Image
                  src="/brand/banner.png"
                  alt="Investigator Network"
                  width={720}
                  height={480}
                  className="h-full w-full object-cover opacity-90"
                  priority
                />
                <span className="tag-chip absolute bottom-3 left-3">
                  // Case file: open
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------- what the platform is */}
        <section className="relative">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <header className="border-b border-border pb-3">
              <p className="eyebrow eyebrow-gold">01 / The platform</p>
              <h2 className="display-lg mt-2">Everything you need to train</h2>
            </header>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: "Live sessions",
                  desc: "Instructor-led training delivered through Microsoft Teams — real-time, interactive, and scheduled.",
                },
                {
                  title: "On-demand video",
                  desc: "Self-paced course modules available anytime, so training fits around active casework.",
                },
                {
                  title: "Assessments",
                  desc: "Knowledge checks and practical exercises that reinforce every module before you move on.",
                },
                {
                  title: "Certificates",
                  desc: "Verifiable credentials issued on completion — proof of training that stands up to review.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="panel panel-hover rule-top p-5"
                >
                  <h3 className="display-sm text-foreground">{item.title}</h3>
                  <p className="mt-3 text-sm text-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------- gated access explainer */}
        <section className="relative">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <header className="border-b border-border pb-3">
              <p className="eyebrow eyebrow-gold">02 / Gated access</p>
              <h2 className="display-lg mt-2">Reviewed before granted</h2>
            </header>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Submit a request",
                  desc: "Register with your name, agency, and credentials. Your request enters a review queue.",
                },
                {
                  step: "02",
                  title: "Admin review",
                  desc: "An administrator verifies your identity and agency affiliation before any access is granted.",
                },
                {
                  step: "03",
                  title: "Access granted",
                  desc: "Once approved, you can sign in and begin training immediately. Denied requests are communicated.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="panel panel-hover rule-top-gold rule-top p-5"
                >
                  <p className="font-display text-2xl font-black text-gold">
                    {item.step}
                  </p>
                  <h3 className="display-sm mt-3 text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm text-muted">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link href="/register" className="btn btn-primary">
                Request access
              </Link>
              <span className="tag-chip">
                // Status: awaiting credentials
              </span>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------- footer */}
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-8 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/brand/logo.png"
                alt="Investigator Network"
                width={28}
                height={28}
              />
              <span className="leading-none">
                <span className="eyebrow eyebrow-muted block text-[8px]">
                  Intellect LE
                </span>
                <span className="display-sm block text-[12px] text-foreground">
                  Investigator Network
                </span>
              </span>
            </div>
            <p className="font-mono text-[10px] text-muted">
              <span className="opacity-60">// </span>
              AUTHORIZED PERSONNEL ONLY — ALL ACTIVITY LOGGED
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
