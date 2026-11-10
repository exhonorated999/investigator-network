import Image from "next/image";
import type { ReactNode } from "react";

/** Course slug that gets the bespoke FirstWave landing page. */
export const FIRSTWAVE_LANDING_SLUG = "firstwave";

const IMG = "/course-landing/firstwave";

/** Public feeds FirstWave pulls onto the map (from the app's Area setup). */
const SOURCES = [
  ["NWS", "alerts"],
  ["NEXRAD", "radar"],
  ["NASA FIRMS", "fire hotspots"],
  ["Wildfire", "perimeters"],
  ["NOAA", "river gauges"],
  ["NOAA", "tides & surf"],
  ["USGS", "river cameras"],
  ["State DOT", "cameras & closures"],
  ["Utility", "power outages"],
  ["ADS-B", "aircraft"],
  ["USGS", "quakes & volcanoes"],
  ["Local", "news"],
];

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Pick your area",
    body: "Choose a county and check the layers you need. FirstWave builds the picture for you.",
  },
  {
    n: "02",
    title: "Watch it unfold",
    body: "Alerts, fire detections, river levels and live cameras update on one shared map.",
  },
  {
    n: "03",
    title: "Deploy teams",
    body: "Drag a box over the neighborhood and hand each team its own address list.",
  },
  {
    n: "04",
    title: "Know every door",
    body: "Crews report from their phones and the map fills in, color by color.",
  },
];

type Feature = {
  tag: string;
  title: string;
  lead: string;
  points: string[];
  img: string;
  alt: string;
  w: number;
  h: number;
  phone?: boolean;
  note?: string;
};

const FEATURES: Feature[] = [
  {
    tag: "Situational awareness",
    title: "One picture from minute one",
    lead: "Stop juggling a dozen browser tabs. Set your area once and every public feed that matters lands on the same map.",
    points: [
      "Weather watches, warnings and live NEXRAD radar",
      "Satellite fire detections alongside wildfire incidents",
      "River gauges, tides, outages, aircraft and earthquakes",
    ],
    img: "fw-area-setup.png",
    alt: "FirstWave Area setup dialog with public data layers selected over a county map",
    w: 779,
    h: 420,
  },
  {
    tag: "Live imagery",
    title: "Eyes on scene before you roll",
    lead: "See the water level, the traffic or the smoke for yourself. Camera feeds and sensor readings pop up right where they are.",
    points: [
      "State DOT roadway video and road closures",
      "USGS river and coastal camera stills",
      "NOAA gauge and tide readings in a click",
    ],
    img: "fw-eyes-on-scene.png",
    alt: "FirstWave map with USGS river cameras, a NOAA tide station and a river gauge open",
    w: 779,
    h: 427,
  },
  {
    tag: "Evacuation & recovery",
    title: "Door-to-door, organized",
    lead: "Spin up an evacuation or recovery deployment in seconds and give every team a clear, trackable assignment.",
    points: [
      "Drag a box on the map to build an address list",
      "Color-coded addresses and per-team progress",
      "Running counts: knocked, evacuated, remaining",
    ],
    img: "fw-evacuation.png",
    alt: "FirstWave response panel showing a deployment, team progress and color-coded address pins",
    w: 779,
    h: 440,
    note: "Demo data, addresses masked",
  },
  {
    tag: "Field reports",
    title: "Any phone becomes a field terminal",
    lead: "Crews scan a QR code or tap a link and they're working. Nothing to install, nothing to log into.",
    points: [
      "No app store, account or password",
      "One tap per door: evacuated, remained, needs help, refused",
      "Photos and video attached, encrypted end to end",
    ],
    img: "fw-phone-report.png",
    alt: "FirstWave mobile field report form with contact and evacuation status buttons",
    w: 408,
    h: 622,
    phone: true,
  },
  {
    tag: "Command view",
    title: "Know where things stand",
    lead: "Results flow back to the operations computer every few minutes, so command sees what the street sees.",
    points: [
      "Door outcomes, photos and video on the map",
      "Live cameras over the response zone",
      "Instant red alert when someone needs help",
    ],
    img: "fw-cameras-sync.png",
    alt: "FirstWave command view with live Caltrans cameras above a team's color-coded route",
    w: 779,
    h: 456,
  },
];

const STATUSES: [string, string][] = [
  ["Evacuated", "#34d399"],
  ["Remained", "#fbbf24"],
  ["Needs help", "#f87171"],
  ["Refused", "#c084fc"],
  ["No contact", "#fb923c"],
  ["Unable to reach", "#94a3b8"],
];

const AUDIENCE: { icon: string; title: string; body: string }[] = [
  {
    icon: "🛡",
    title: "Patrol & sheriff's units",
    body: "Run evacuation notifications without clipboards, radio roll-calls or guesswork.",
  },
  {
    icon: "🧭",
    title: "Emergency managers",
    body: "Hold the whole operating picture, from the first weather alert to recovery.",
  },
  {
    icon: "🚒",
    title: "Fire & rescue partners",
    body: "Share fire detections, cameras and door status with everyone on the incident.",
  },
  {
    icon: "🤝",
    title: "Civilian & volunteer teams",
    body: "Put trained helpers to work with nothing more than the phone in their pocket.",
  },
];

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Image src={`${IMG}/fw-logo.png`} alt="" width={60} height={26} className="h-[22px] w-auto" />
      <span className="fw-wordmark">
        First<span>Wave</span>
      </span>
    </span>
  );
}

export function FirstWaveLanding({
  lessonCount,
  hours,
  cta,
  enrolled,
}: {
  lessonCount: number;
  hours: number | null;
  cta: ReactNode;
  enrolled: boolean;
}) {
  return (
    <div className="fw-landing mt-5">
      {/* ------------------------------------------------------------ hero */}
      <section className="fw-hero reveal reveal-1">
        <div className="fw-hero-glow" aria-hidden />
        <div className="relative grid items-center gap-12 px-6 pb-10 pt-12 sm:px-10 lg:grid-cols-[1.05fr_1fr] lg:pb-14 lg:pt-16">
          <div>
            <div className="flex flex-wrap items-center gap-4">
              <Wordmark />
              <span className="fw-pill">{enrolled ? "You're enrolled" : "Free onboarding course"}</span>
            </div>
            <h1 className="fw-display mt-7">
              When disaster hits,
              <br />
              <span className="fw-glow">see everything.</span>
              <br />
              Reach every door.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#c3cad6]">
              FirstWave puts weather, fire, flood and camera intel on one live
              map, then runs your evacuation and recovery from it. Crews report
              door by door from any phone, and command sees it all come in.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">{cta}</div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-white/10 pt-6">
              <div>
                <dt className="fw-stat-label">Video lessons</dt>
                <dd className="fw-stat">{Math.max(lessonCount, 1)}</dd>
              </div>
              <div>
                <dt className="fw-stat-label">Training</dt>
                <dd className="fw-stat">{hours ? `${hours} hr` : "Self-paced"}</dd>
              </div>
              <div>
                <dt className="fw-stat-label">Cost to agencies</dt>
                <dd className="fw-stat">$0</dd>
              </div>
            </dl>
          </div>

          {/* screenshot composite: map + phone */}
          <div className="relative pb-10 sm:pb-16 lg:pb-0">
            <div className="fw-halo" aria-hidden />
            <div className="fw-frame">
              <Image
                src={`${IMG}/fw-evacuation.png`}
                alt="FirstWave map with an active evacuation deployment"
                width={779}
                height={440}
                priority
                className="block h-auto w-full"
              />
            </div>
            <div className="fw-hero-phone">
              <Image
                src={`${IMG}/fw-phone-report.png`}
                alt="FirstWave field report on a phone"
                width={408}
                height={622}
                priority
                className="fw-phone-img block h-auto w-full"
              />
            </div>
            <div className="fw-float fw-float-a">
              <span className="fw-dot fw-dot-amber" /> Lake Wind Advisory · until 4:00 PM
            </div>
            <div className="fw-float fw-float-b">
              <span className="fw-dot fw-dot-red" /> Needs help · Team 1 notified
            </div>
          </div>
        </div>

        {/* sources marquee */}
        <div className="relative border-t border-white/10 bg-black/25 py-4">
          <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.28em] text-[#7d8899]">
            Open, public, read-only sources on one map
          </p>
          <div className="fw-marquee">
            <div className="fw-marquee-track">
              {[...SOURCES, ...SOURCES].map(([a, b], i) => (
                <span key={i} className="fw-source" aria-hidden={i >= SOURCES.length}>
                  {a}
                  <em>{b}</em>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ how it works */}
      <section className="reveal reveal-2 mt-20">
        <p className="eyebrow fw-eyebrow">01 / How it works</p>
        <h2 className="display-lg mt-3 max-w-3xl">From the first alert to the last door.</h2>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Most incidents start with a warning and end with someone asking
          &ldquo;did we get everyone?&rdquo; FirstWave covers the whole arc in
          one tool.
        </p>
        <ol className="fw-steps mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="panel fw-card relative p-6">
              <span className="fw-step-n">{s.n}</span>
              <h3 className="display-sm mt-4">{s.title}</h3>
              <p className="mt-2 text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* --------------------------------------------------------- features */}
      <section className="mt-24">
        <p className="eyebrow fw-eyebrow">02 / Inside FirstWave</p>
        <h2 className="display-lg mt-3 max-w-3xl">Built for the worst day of the year.</h2>

        <div className="mt-12 space-y-20">
          {FEATURES.map((f, i) => {
            const flip = i % 2 === 1;
            return (
              <article
                key={f.title}
                className="reveal reveal-2 grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]"
              >
                <div className={flip ? "lg:order-2" : ""}>
                  <p className="fw-tag">
                    <span>{String(i + 1).padStart(2, "0")}</span> {f.tag}
                  </p>
                  <h3 className="fw-h3 mt-4">{f.title}</h3>
                  <p className="mt-4 text-lg leading-relaxed text-muted">{f.lead}</p>
                  <ul className="mt-6 space-y-3">
                    {f.points.map((p) => (
                      <li key={p} className="flex gap-3 text-foreground">
                        <span className="fw-bullet" aria-hidden />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <figure className={`relative ${flip ? "lg:order-1" : ""}`}>
                  {f.phone ? (
                    <div className="fw-phone-wrap">
                      <div className="fw-halo" aria-hidden />
                      <Image
                        src={`${IMG}/${f.img}`}
                        alt={f.alt}
                        width={f.w}
                        height={f.h}
                        className="fw-phone-img relative mx-auto block h-auto w-full max-w-[300px]"
                      />
                    </div>
                  ) : (
                    <div className="fw-screen">
                      <div className="fw-screen-bar">
                        <span />
                        <span />
                        <span />
                        <em>firstwave — {f.tag.toLowerCase()}</em>
                      </div>
                      <Image
                        src={`${IMG}/${f.img}`}
                        alt={f.alt}
                        width={f.w}
                        height={f.h}
                        className="block h-auto w-full"
                      />
                    </div>
                  )}
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

      {/* ---------------------------------------------------- status band */}
      <section className="fw-band reveal reveal-3 mt-24">
        <div className="relative grid gap-10 px-7 py-12 sm:px-12 sm:py-14 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="eyebrow">03 / Every door, one color</p>
            <h2 className="display-lg mt-4 text-[#f3f5f8]">
              Answer &ldquo;did we get everyone?&rdquo; <span className="fw-glow">at a glance.</span>
            </h2>
            <p className="mt-5 max-w-xl text-lg text-[#b8c0cc]">
              Every address on the map carries its outcome. Teams show their
              progress in their own ring color, and a &ldquo;needs help&rdquo;
              report turns red the moment it&apos;s sent.
            </p>
            <ul className="mt-8 flex flex-wrap gap-2.5">
              {STATUSES.map(([label, color]) => (
                <li key={label} className="fw-status" style={{ ["--c" as string]: color }}>
                  <span />
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <dl className="grid grid-cols-2 gap-px self-center overflow-hidden border border-white/10 bg-white/10">
            {[
              ["0", "Apps to install", "Crews work in the phone's browser"],
              ["E2E", "Encrypted", "Reports, photos and video"],
              ["~5 min", "Sync cycle", "Field results back to command"],
              ["Free", "For every agency", "No contract, no seat count"],
            ].map(([big, label, sub]) => (
              <div key={label} className="bg-[#0c121b] p-6">
                <dt className="fw-stat-label">{label}</dt>
                <dd className="fw-stat mt-1">{big}</dd>
                <dd className="mt-1 text-sm text-[#8e98a7]">{sub}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------------------------------------------------- who it's for */}
      <section className="reveal reveal-3 mt-24">
        <p className="eyebrow fw-eyebrow">04 / Who it&apos;s for</p>
        <h2 className="display-lg mt-3 max-w-3xl">Anyone who has to knock on doors when it counts.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCE.map((a) => (
            <div key={a.title} className="panel fw-card p-6">
              <span className="fw-icon" aria-hidden>
                {a.icon}
              </span>
              <h3 className="display-sm mt-4">{a.title}</h3>
              <p className="mt-2 text-muted">{a.body}</p>
            </div>
          ))}
        </div>

        <div className="panel fw-card mt-6 grid gap-6 p-7 sm:grid-cols-[auto_1fr] sm:items-center sm:p-9">
          <span className="fw-step-n text-5xl">▶</span>
          <div>
            <h3 className="display-sm">What the onboarding course gives you</h3>
            <p className="mt-2 max-w-3xl text-muted">
              A guided video walkthrough of FirstWave, from setting up your
              area to running a deployment, at your own pace. Watch it before
              the next incident and you&apos;ll be ready to stand it up the
              moment you need it.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- final cta */}
      <section className="fw-band reveal reveal-3 mt-24 text-center">
        <div className="relative px-7 py-12 sm:px-12 sm:py-16">
          <Wordmark className="justify-center" />
          <h2 className="display-lg mx-auto mt-6 max-w-3xl text-[#f3f5f8]">
            The training is <span className="fw-glow">free.</span>
            <br />
            FirstWave is free for every agency.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-[#b8c0cc]">
            Learn it now, on a quiet day, so it&apos;s second nature when the
            sirens start.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">{cta}</div>
        </div>
      </section>
    </div>
  );
}
