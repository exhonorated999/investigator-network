import Image from "next/image";
import type { ReactNode } from "react";
import { ViperShowcase } from "./viper-showcase";

/** Course slug that gets the bespoke VIPER landing page. */
export const VIPER_LANDING_SLUG = "project-v-i-p-e-r";

export type LandingSection = { title: string; units: string[] };

const AGENCIES = [
  ["Fort Worth PD", "TX"],
  ["Chesapeake PD", "VA"],
  ["Westminster PD", "CO"],
  ["Gurnee PD", "IL"],
  ["Faulkner County SO", "AR"],
  ["Alleghany County SO", "VA"],
  ["Winnemucca PD", "NV"],
  ["Allegheny Township", "PA"],
  ["South Whitehall Twp PD", "PA"],
];

const PAINS: { before: string; after: string }[] = [
  {
    before: "Warrant returns forgotten in a spreadsheet while the provider sits on them",
    after: "A warrant dashboard that flags every late return so you can follow up",
  },
  {
    before: "Case notes, PDFs and photos scattered across folders and thumb drives",
    after: "One encrypted case file for suspects, victims, evidence, reports and media",
  },
  {
    before: "Late nights counting arrests and seizures for the year-end evaluation",
    after: "Live totals on your dashboard and a monthly case status report in one click",
  },
];

const CAPABILITIES: { icon: string; title: string; body: string }[] = [
  {
    icon: "◎",
    title: "Case command center",
    body: "Create cases, track suspects, victims and evidence, and write reports with auto-save. A customizable dashboard keeps your whole caseload in view.",
  },
  {
    icon: "⚖",
    title: "Warrants, start to finish",
    body: "Author warrants from templates, then parse Meta and Google returns automatically, so hours of review come down to minutes.",
  },
  {
    icon: "📡",
    title: "Phones & cell towers",
    body: "Analyze AT&T, Verizon and T-Mobile tower dumps, and turn DataPilot or Cellebrite extractions into contacts, patterns and leads.",
  },
  {
    icon: "🛡",
    title: "Built for ICAC",
    body: "Open CyberTip investigations, review BitTorrent single-source downloads with Probable Cause language, and keep IDS stats current.",
  },
  {
    icon: "🎙",
    title: "Field & undercover tools",
    body: "Area Canvas, Operations Plan Builder, undercover chat capture and offline Whisper dictation and transcription, all inside the case.",
  },
  {
    icon: "📁",
    title: "Court-ready in one click",
    body: "The DA Package exports every report and piece of evidence into a single, organized folder for discovery.",
  },
];

const SECURITY: { big: string; label: string; note: string }[] = [
  { big: "100%", label: "Local", note: "Installs on your workstation. No cloud, no vendor server." },
  { big: "AES-256", label: "Encrypted", note: "The software and every case file, encrypted at rest." },
  { big: "USB", label: "Portable", note: "Run it from a thumb drive and work anywhere, even offline." },
  { big: "0", label: "Vendor access", note: "We can't see, copy or retrieve your data. It stays inside your CJIS perimeter." },
];

/** Short one-liners per known section; falls back to the unit list. */
const SECTION_BLURB: [RegExp, string][] = [
  [/notes|documentation/i, "Install guide, the security and CJIS documentation your I.T. department will ask for, and the FAQ."],
  [/management/i, "Set up VIPER and work a case end to end: dashboard, cases, reports, suspects, evidence, ops plans and the connection board."],
  [/resources/i, "The investigative toolkit: warrant parsing, cell tower dumps, undercover chats, transcription, Area Canvas and field work."],
  [/icac/i, "CyberTip investigations, P2P/BitTorrent cases, community outreach and IDS statistics."],
  [/supervisor/i, "The free command dashboard: assign cases, approve ops plans, run ICAC intake and pull unit stats."],
];

function cleanUnit(title: string) {
  return title.replace(/\s*-\s*updated\s+[\d/]+\s*$/i, "").trim();
}

function sectionBlurb(title: string) {
  return SECTION_BLURB.find(([re]) => re.test(title))?.[1] ?? null;
}

/**
 * Bespoke marketing landing page for the Project V.I.P.E.R. onboarding course.
 * Server component; the screenshot viewer is the only client island. `cta`
 * is the enrollment control the course page already knows how to render
 * (enroll form / resume link), so gating logic stays in the page.
 */
export function ViperLanding({
  sections,
  lessonCount,
  cta,
  enrolled,
}: {
  sections: LandingSection[];
  lessonCount: number;
  cta: ReactNode;
  enrolled: boolean;
}) {
  const moduleCount = sections.length;

  return (
    <div className="viper-landing">
      {/* ------------------------------------------------------------ hero */}
      <section className="viper-hero reveal reveal-1 mt-5">
        <div className="viper-hero-grid" aria-hidden />
        <div className="relative grid items-center gap-10 p-7 sm:p-10 lg:grid-cols-[1.05fr_1fr] lg:p-12">
          <div>
            <span className="viper-pill">
              {enrolled ? "You're enrolled" : "Free onboarding course"}
            </span>
            <h1 className="display-xl mt-6 text-[#eef6ee]">
              Project
              <br />
              <span className="viper-glow">V.I.P.E.R.</span>
            </h1>
            <p className="mt-5 font-display text-sm font-semibold uppercase tracking-[0.22em] text-[#a9c2ad]">
              The investigator&apos;s digital command center
            </p>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#c6d4ca]">
              Built by an ICAC detective who was tired of losing track of
              warrant returns. VIPER puts your cases, warrants, evidence and
              digital forensics in one encrypted platform that runs entirely
              on your own machine. This course takes you from install to
              power user, free.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">{cta}</div>
            <dl className="mt-9 grid max-w-lg grid-cols-3 gap-px overflow-hidden border border-[rgba(126,224,58,0.22)] bg-[rgba(126,224,58,0.22)]">
              {[
                [String(lessonCount), "Video lessons"],
                [String(moduleCount), "Modules"],
                ["$0", "Course cost"],
              ].map(([v, l]) => (
                <div key={l} className="bg-[#0b120d] px-4 py-3">
                  <dt className="sr-only">{l}</dt>
                  <dd className="font-display text-2xl font-black text-[#b6f57c]">{v}</dd>
                  <dd className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[#8aa290]">
                    {l}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="viper-halo" aria-hidden />
            <div className="viper-frame">
              <Image
                src="/course-landing/viper/hero-banner.png"
                alt="Project V.I.P.E.R. emblem"
                width={1536}
                height={1024}
                priority
                sizes="(min-width: 1024px) 560px, 100vw"
                className="block h-auto w-full"
              />
            </div>
            <div className="viper-float viper-float-a">
              <span className="text-[#b6f57c]">●</span> Warrant return 12d overdue
            </div>
            <div className="viper-float viper-float-b">
              <span className="text-[#b6f57c]">🔒</span> AES-256 · offline
            </div>
          </div>
        </div>

        {/* trust strip */}
        <div className="relative border-t border-[rgba(126,224,58,0.18)] bg-[rgba(0,0,0,0.35)] py-4">
          <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-[#7f9585]">
            In use at agencies like
          </p>
          <div className="viper-marquee">
            <div className="viper-marquee-track">
              {[...AGENCIES, ...AGENCIES].map(([name, st], i) => (
                <span key={i} aria-hidden={i >= AGENCIES.length} className="viper-agency">
                  {name} <em>{st}</em>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- the why */}
      <section className="reveal reveal-2 mt-20 grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="eyebrow viper-eyebrow">01 / Why VIPER exists</p>
          <h2 className="display-lg mt-3">
            Managing a case shouldn&apos;t be harder than solving it.
          </h2>
          <blockquote className="mt-6 border-l-2 border-[var(--viper)] pl-5 text-lg italic leading-relaxed text-muted">
            &ldquo;Like many of you, I relied on spreadsheets, physical files, and
            PDF checklists to manage a mountain of cases, warrants, and
            evidence&hellip; I needed a solution that was easy to use and covered
            the entire workflow — from the initial tip to booking evidence. With
            input from fellow detectives, I built VIPER to be that
            solution.&rdquo;
            <footer className="mt-3 font-mono text-xs not-italic uppercase tracking-[0.16em] text-muted/80">
              — VIPER&apos;s creator, ICAC Detective
            </footer>
          </blockquote>
        </div>
        <ul className="space-y-3">
          {PAINS.map((p) => (
            <li key={p.before} className="panel grid gap-0 sm:grid-cols-2">
              <div className="border-b border-border p-5 sm:border-b-0 sm:border-r">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-danger/80">
                  Before
                </p>
                <p className="mt-2 text-muted line-through decoration-danger/40">{p.before}</p>
              </div>
              <div className="bg-[var(--viper-soft)] p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--viper-ink)]">
                  With VIPER
                </p>
                <p className="mt-2 font-semibold text-foreground">{p.after}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------- capabilities */}
      <section className="reveal reveal-3 mt-20">
        <p className="eyebrow viper-eyebrow">02 / What it does</p>
        <h2 className="display-lg mt-3 max-w-3xl">
          Not just a database. A multitool for complex cases.
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <article key={c.title} className="panel panel-hover viper-card p-6">
              <span className="viper-icon" aria-hidden>
                {c.icon}
              </span>
              <h3 className="mt-4 text-[15px] tracking-[0.06em] text-foreground">{c.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- showcase */}
      <section className="reveal reveal-3 mt-20">
        <p className="eyebrow viper-eyebrow">03 / See it in action</p>
        <h2 className="display-lg mt-3">One platform, every stage of the case.</h2>
        <p className="mt-3 max-w-2xl text-muted">
          Real screens from VIPER. Every one is covered step by step in the
          course. (All names and numbers shown are fictional sample data.)
        </p>
        <div className="mt-8">
          <ViperShowcase />
        </div>
      </section>

      {/* -------------------------------------------------------- security */}
      <section className="viper-band reveal reveal-3 mt-20">
        <div className="relative p-7 sm:p-10">
          <p className="eyebrow text-[#b6f57c]">04 / Off-the-grid security</p>
          <h2 className="display-lg mt-3 text-[#eef6ee]">
            Your case data never leaves your desk.
          </h2>
          <p className="mt-3 max-w-2xl text-[#b5c6ba]">
            No SaaS, no subscriptions and no AI training on your data. The
            course notes include the CJIS and security documentation your I.T.
            department will ask for.
          </p>
          <div className="mt-8 grid gap-px overflow-hidden border border-[rgba(126,224,58,0.2)] bg-[rgba(126,224,58,0.2)] sm:grid-cols-2 lg:grid-cols-4">
            {SECURITY.map((s) => (
              <div key={s.label} className="bg-[#0a0f0b] p-6">
                <p className="font-display text-3xl font-black text-[#b6f57c]">{s.big}</p>
                <p className="mt-1 font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-[#eef6ee]">
                  {s.label}
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-[#95a99b]">{s.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- modules */}
      <section className="reveal reveal-3 mt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow viper-eyebrow">05 / What you&apos;ll learn</p>
            <h2 className="display-lg mt-3">From install to power user.</h2>
          </div>
          <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted">
            {lessonCount} lessons · self-paced · watch in any order
          </span>
        </div>
        <ol className="mt-8 grid gap-4 md:grid-cols-2">
          {sections.map((s, i) => {
            const blurb = sectionBlurb(s.title);
            const units = s.units.map(cleanUnit);
            const shown = units.slice(0, 6);
            return (
              <li
                key={s.title}
                className={`panel viper-module p-6 ${
                  i === sections.length - 1 && sections.length % 2 === 1 ? "md:col-span-2" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="font-display text-4xl font-black leading-none text-[var(--viper-ink)] opacity-80">
                    {(i + 1).toString().padStart(2, "0")}
                  </span>
                  <span className="tag-chip">
                    {units.length} {units.length === 1 ? "unit" : "units"}
                  </span>
                </div>
                <h3 className="mt-4 text-base tracking-[0.05em] text-foreground">
                  {s.title.replace(/^Project V\.I\.P\.E\.R\.\s*/i, "")}
                </h3>
                {blurb ? <p className="mt-2 text-[15px] text-muted">{blurb}</p> : null}
                <ul className="mt-4 flex flex-wrap gap-2">
                  {shown.map((u) => (
                    <li
                      key={u}
                      className="border border-border bg-well-soft px-2.5 py-1 font-mono text-[11px] text-muted"
                    >
                      {u}
                    </li>
                  ))}
                  {units.length > shown.length ? (
                    <li className="px-1 py-1 font-mono text-[11px] text-[var(--viper-ink)]">
                      +{units.length - shown.length} more
                    </li>
                  ) : null}
                </ul>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ----------------------------------------------------- testimonial */}
      <section className="reveal reveal-3 mt-20">
        <figure className="panel viper-quote relative overflow-hidden p-8 sm:p-12">
          <span className="viper-quote-mark" aria-hidden>
            &ldquo;
          </span>
          <blockquote className="relative max-w-3xl text-xl leading-relaxed text-foreground sm:text-2xl">
            Project V.I.P.E.R. has been a game changer for me as a detective. It
            serves as a true investigative multitool&hellip; The ability to parse
            and analyze search warrant returns has also been extremely
            beneficial, significantly reducing the time required to review
            large amounts of data.
          </blockquote>
          <figcaption className="relative mt-6 font-mono text-xs uppercase tracking-[0.18em] text-muted">
            Detective · South Whitehall Township Police Department, PA
          </figcaption>
        </figure>
      </section>

      {/* ------------------------------------------------------- final cta */}
      <section className="viper-band reveal reveal-3 mt-20 text-center">
        <div className="relative px-7 py-12 sm:px-12 sm:py-16">
          <p className="eyebrow text-[#b6f57c]">Ready when you are</p>
          <h2 className="display-lg mx-auto mt-4 max-w-3xl text-[#eef6ee]">
            The training is <span className="viper-glow">free.</span>
            <br />
            The software is free for 60 days.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-[#b5c6ba]">
            Enroll at no cost, learn at your own pace, and get every feature
            unlocked during the 60-day trial, no credit card required. After
            that it&apos;s a one-time lifetime license, never a subscription,
            and you&apos;re never locked out of your own cases.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">{cta}</div>
        </div>
      </section>
    </div>
  );
}
