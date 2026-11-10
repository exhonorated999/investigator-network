import Image from "next/image";
import type { ReactNode } from "react";

/** Course slug that gets the bespoke Project Oversight landing page. */
export const OVERSIGHT_LANDING_SLUG = "project-oversight-offender-management";

const IMG = "/course-landing/oversight";

/** What a registrant unit tracks — all visible in the app's screens. */
const TRACKED = [
  "Registration",
  "Compliance checks",
  "Supervision status",
  "Tiers & SVP",
  "Polygraphs",
  "Therapy",
  "Court dates",
  "Static-99 / Stable-2007",
  "Vehicles & residences",
  "Multi-jurisdiction sweeps",
  "CSV import",
  "PDF export",
];

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Import your caseload",
    body: "Bring your registrants in from a spreadsheet. No retyping the whole unit.",
  },
  {
    n: "02",
    title: "Build the profile",
    body: "Descriptors, photos, residences, vehicles, tier and risk scores, all in one record.",
  },
  {
    n: "03",
    title: "Run the checks",
    body: "Log compliance checks one by one or plan a full sweep with S.C.O.P.E.",
  },
  {
    n: "04",
    title: "Share & hand off",
    body: "Work as one office on your local network, and send profiles to investigators.",
  },
];

type Feature = {
  tag: string;
  title: string;
  accent: string;
  lead: string;
  points: string[];
  badge: string;
  img: string;
  alt: string;
  w: number;
  h: number;
  note?: string;
};

// Copy follows the Project Oversight feature cards.
const FEATURES: Feature[] = [
  {
    tag: "Local by design",
    title: "Runs locally.",
    accent: "You own your data.",
    lead: "Your records stay on your agency's own computers. Your dashboard shows the caseload, the calendar and what's due today.",
    points: [
      "No cloud storage or external hosting",
      "Data never leaves your building",
      "Keeps working when the internet is down",
    ],
    badge: "Offline ready",
    img: "po-dashboard.png",
    alt: "Project Oversight case dashboard with offender counts, calendar and to-do list",
    w: 723,
    h: 404,
  },
  {
    tag: "Department database",
    title: "Share live across",
    accent: "your office.",
    lead: "One database for the whole unit, on your local network. Nothing is sent to the cloud.",
    points: [
      "One office computer hosts the database",
      "Other computers join with a simple code",
      "Live updates over your local network",
      "Encrypted, with automatic daily backups",
    ],
    badge: "Encrypted · daily backups",
    img: "po-department-db.png",
    alt: "Project Oversight Department Database settings with a join code, firewall status and backups",
    w: 723,
    h: 458,
  },
  {
    tag: "S.C.O.P.E.",
    title: "Field checks.",
    accent: "No app required.",
    lead: "The Structured Compliance Operations & Planning Engine: plan compliance checks at the office, complete them in the field.",
    points: [
      "Select offenders, share a short-term QR link",
      "Officers complete forms in the field",
      "One click syncs results back",
      "Automatic after-action reports",
    ],
    badge: "Scan · check · sync",
    img: "po-scope.png",
    alt: "Project Oversight S.C.O.P.E. dashboard listing compliance sweeps",
    w: 723,
    h: 398,
  },
  {
    tag: "Geographic awareness",
    title: "See your jurisdiction",
    accent: "at a glance.",
    lead: "Map-based insight for faster, better-informed decisions, filtered by status and tier.",
    points: [
      "Visualize offender locations on the map",
      "Identify potential suspects in an area",
      "Tactical decision support",
      "Only GPS coordinates are transmitted",
    ],
    badge: "Only GPS coordinates sent",
    img: "po-map.png",
    alt: "Project Oversight geographic distribution map with tier filters and compliance alerts",
    w: 723,
    h: 400,
    note: "Sample data",
  },
  {
    tag: "Investigations handoff",
    title: "Hand off to",
    accent: "Project V.I.P.E.R.",
    lead: "Send a full profile from supervision to investigation when a case calls for it.",
    points: [
      "Export the complete offender profile",
      "Photos and residence images",
      "Vehicles and notes",
      "Ready for investigations in V.I.P.E.R.",
    ],
    badge: "Full profile export",
    img: "po-profile.png",
    alt: "Project Oversight offender profile with descriptors, quick intel and risk assessment scores",
    w: 723,
    h: 429,
    note: "Sample profile",
  },
];

const TIERS: [string, string][] = [
  ["Tier 1", "#4ade80"],
  ["Tier 2", "#facc15"],
  ["Tier 3", "#fb923c"],
  ["SVP", "#f87171"],
  ["Active", "#34d399"],
  ["Incarcerated", "#a78bfa"],
];

const AUDIENCE: { icon: string; title: string; body: string }[] = [
  {
    icon: "📋",
    title: "Registration units",
    body: "Civilian and sworn staff who keep the registry current, from intake to annual updates.",
  },
  {
    icon: "✅",
    title: "Compliance teams",
    body: "Plan address verifications and sweeps, then close them out with an automatic report.",
  },
  {
    icon: "⚖",
    title: "Probation & parole",
    body: "Track supervision status, therapy, polygraphs and court dates in one place.",
  },
  {
    icon: "🔎",
    title: "Investigators",
    body: "Pull a complete profile into Project V.I.P.E.R. when supervision becomes a case.",
  },
];

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <Image
        src={`${IMG}/po-logo.png`}
        alt=""
        width={44}
        height={44}
        className="h-9 w-9 rounded-lg"
      />
      <span className="po-wordmark">
        Project <span>Oversight</span>
      </span>
    </span>
  );
}

export function OversightLanding({
  lessonCount,
  cta,
  enrolled,
}: {
  lessonCount: number;
  cta: ReactNode;
  enrolled: boolean;
}) {
  return (
    <div className="po-landing mt-5">
      {/* ------------------------------------------------------------ hero */}
      <section className="po-hero reveal reveal-1">
        <div className="po-hero-grid" aria-hidden />
        <div className="relative grid items-center gap-12 px-6 pb-12 pt-12 sm:px-10 lg:grid-cols-[1fr_1.05fr] lg:pb-16 lg:pt-16">
          <div>
            <div className="flex flex-wrap items-center gap-4">
              <Wordmark />
              <span className="po-pill">{enrolled ? "You're enrolled" : "Free onboarding course"}</span>
            </div>
            <h1 className="po-display mt-7">
              Every registrant.
              <br />
              Every check.
              <br />
              <span className="po-glow">Your data.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#cdc3d8]">
              Project Oversight is offender management for the units that
              supervise sex offenders, probationers and parolees. Registration,
              compliance checks, sweeps and mapping live in one desktop app, and
              your records never leave your building.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">{cta}</div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-white/10 pt-6">
              <div>
                <dt className="po-stat-label">Video lessons</dt>
                <dd className="po-stat">{Math.max(lessonCount, 1)}</dd>
              </div>
              <div>
                <dt className="po-stat-label">Cloud servers</dt>
                <dd className="po-stat">0</dd>
              </div>
              <div>
                <dt className="po-stat-label">Training cost</dt>
                <dd className="po-stat">$0</dd>
              </div>
            </dl>
          </div>

          {/* screenshot composite: dashboard + map */}
          <div className="relative pb-14 sm:pb-20 lg:pb-10">
            <div className="po-halo" aria-hidden />
            <div className="po-frame">
              <div className="po-screen-bar">
                <span />
                <span />
                <span />
                <em>Project Oversight</em>
              </div>
              <Image
                src={`${IMG}/po-dashboard.png`}
                alt="Project Oversight case dashboard"
                width={723}
                height={404}
                priority
                className="block h-auto w-full"
              />
            </div>
            <div className="po-hero-inset">
              <Image
                src={`${IMG}/po-map.png`}
                alt="Project Oversight jurisdiction map"
                width={723}
                height={400}
                priority
                className="block h-auto w-full"
              />
            </div>
            <div className="po-float po-float-a">
              <span className="po-dot po-dot-amber" /> Compliance check required · 1 offender
            </div>
            <div className="po-badge po-float-b">
              <span aria-hidden>⌂</span> Offline ready
            </div>
          </div>
        </div>

        {/* tracked marquee */}
        <div className="relative border-t border-white/10 bg-black/30 py-4">
          <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.28em] text-[#8f839e]">
            Everything a registrant unit tracks, in one place
          </p>
          <div className="po-marquee">
            <div className="po-marquee-track">
              {[...TRACKED, ...TRACKED].map((t, i) => (
                <span key={i} className="po-chip" aria-hidden={i >= TRACKED.length}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ how it works */}
      <section className="reveal reveal-2 mt-20">
        <p className="eyebrow po-eyebrow">01 / How it works</p>
        <h2 className="display-lg mt-3 max-w-3xl">From intake to the last door knock.</h2>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Spreadsheets, sticky notes and shared drives weren&apos;t built for
          supervising registrants. Oversight follows the way the work is
          actually done.
        </p>
        <ol className="po-steps mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="panel po-card relative p-6">
              <span className="po-step-n">{s.n}</span>
              <h3 className="display-sm mt-4">{s.title}</h3>
              <p className="mt-2 text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* --------------------------------------------------------- features */}
      <section className="mt-24">
        <p className="eyebrow po-eyebrow">02 / Inside Oversight</p>
        <h2 className="display-lg mt-3 max-w-3xl">Built by the people who do the checks.</h2>

        <div className="mt-12 space-y-20">
          {FEATURES.map((f, i) => {
            const flip = i % 2 === 1;
            return (
              <article
                key={f.tag}
                className="reveal reveal-2 grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]"
              >
                <div className={flip ? "lg:order-2" : ""}>
                  <p className="po-tag">
                    <span>{String(i + 1).padStart(2, "0")}</span> {f.tag}
                  </p>
                  <h3 className="po-h3 mt-4">
                    {f.title} <span className="po-glow">{f.accent}</span>
                  </h3>
                  <p className="mt-4 text-lg leading-relaxed text-muted">{f.lead}</p>
                  <ul className="mt-6 space-y-3">
                    {f.points.map((p) => (
                      <li key={p} className="flex gap-3 text-foreground">
                        <span className="po-check" aria-hidden>
                          ✓
                        </span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <figure className={`relative pb-6 ${flip ? "lg:order-1" : ""}`}>
                  <div className="po-screen">
                    <div className="po-screen-bar">
                      <span />
                      <span />
                      <span />
                      <em>Project Oversight</em>
                    </div>
                    <Image
                      src={`${IMG}/${f.img}`}
                      alt={f.alt}
                      width={f.w}
                      height={f.h}
                      className="block h-auto w-full"
                    />
                  </div>
                  <div className={`po-badge po-badge-fig ${flip ? "right-4" : "left-4"}`}>
                    {f.badge}
                  </div>
                  {f.note ? (
                    <figcaption className="mt-2 text-right font-mono text-[11px] text-muted">
                      {f.note}
                    </figcaption>
                  ) : null}
                </figure>
              </article>
            );
          })}
        </div>
      </section>

      {/* ----------------------------------------------------- privacy band */}
      <section className="po-band reveal reveal-3 mt-24">
        <div className="po-hero-grid" aria-hidden />
        <div className="relative grid gap-10 px-7 py-12 sm:px-12 sm:py-14 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="eyebrow">03 / Your data, your building</p>
            <h2 className="display-lg mt-3 text-[#f6f1fa]">
              Sensitive records deserve <span className="po-glow">a locked door.</span>
            </h2>
            <p className="mt-4 max-w-xl text-lg text-[#c2b8cf]">
              Registrant files hold home addresses, vehicles, risk scores and
              treatment details. Oversight keeps them on the machines your agency
              already controls. Only map coordinates go out, and the whole
              office still works from one live database.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              {TIERS.map(([label, c]) => (
                <span key={label} className="po-status" style={{ ["--c" as string]: c }}>
                  <span />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-4">
            {[
              ["0", "Cloud storage", "Records live on your agency's computers"],
              ["LAN", "Office sharing", "Join with a code, live updates"],
              ["Daily", "Encrypted backups", "Kept automatically"],
              ["QR", "Field checks", "No app for officers to install"],
            ].map(([big, label, sub]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                <dt className="po-stat-label">{label}</dt>
                <dd className="po-stat mt-1">{big}</dd>
                <dd className="mt-1 text-sm text-[#9d93ab]">{sub}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------------------------------------------------- who it's for */}
      <section className="reveal reveal-3 mt-24">
        <p className="eyebrow po-eyebrow">04 / Who it&apos;s for</p>
        <h2 className="display-lg mt-3 max-w-3xl">For everyone who keeps the registry honest.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCE.map((a) => (
            <div key={a.title} className="panel po-card p-6">
              <span className="po-icon" aria-hidden>
                {a.icon}
              </span>
              <h3 className="display-sm mt-4">{a.title}</h3>
              <p className="mt-2 text-muted">{a.body}</p>
            </div>
          ))}
        </div>

        <div className="panel po-card mt-6 grid gap-6 p-7 sm:grid-cols-[auto_1fr] sm:items-center sm:p-9">
          <span className="po-step-n text-5xl">▶</span>
          <div>
            <h3 className="display-sm">What the onboarding course gives you</h3>
            <p className="mt-2 max-w-3xl text-muted">
              Short video lessons that take you from installation to your first
              sweep: importing offenders, building profiles, supervision status,
              registration, sharing with your office, and running compliance
              checks with S.C.O.P.E. Plus a step-by-step guide for setting up
              your department database.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- final cta */}
      <section className="po-band reveal reveal-3 mt-24 text-center">
        <div className="po-hero-grid" aria-hidden />
        <div className="relative px-7 py-12 sm:px-12 sm:py-16">
          <Wordmark className="justify-center" />
          <h2 className="display-lg mx-auto mt-6 max-w-3xl text-[#f6f1fa]">
            The onboarding is <span className="po-glow">free.</span>
            <br />
            Your records stay yours.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-[#c2b8cf]">
            Get Oversight installed, your caseload imported and your first
            compliance sweep planned, one short video at a time.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">{cta}</div>
        </div>
      </section>
    </div>
  );
}
