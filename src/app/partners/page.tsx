import Link from "next/link";
import { requireViewer } from "@/lib/viewer";
import { SiteHeader } from "@/components/site-header";
import { loadPartnersForViewer, type PartnerView } from "@/lib/partners";

export const dynamic = "force-dynamic";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function PartnerCard({ p }: { p: PartnerView }) {
  const host = hostOf(p.url);
  return (
    <a
      href={p.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="group panel flex flex-col p-5 transition hover:border-accent"
    >
      <div className="flex items-center gap-4">
        {p.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.logoUrl}
            alt={p.name}
            className="h-14 w-14 shrink-0 rounded border border-border bg-white object-contain p-1.5"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-border bg-surface font-display text-2xl text-muted">
            {p.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-[17px] font-semibold text-foreground group-hover:text-accent-bright">
            {p.name}
          </h3>
          {host ? (
            <p className="truncate font-mono text-[11px] uppercase tracking-wider text-muted">
              {host}
            </p>
          ) : null}
        </div>
      </div>
      {p.blurb ? (
        <p className="mt-4 flex-1 text-[14px] leading-relaxed text-muted">{p.blurb}</p>
      ) : null}
      <span className="mt-4 inline-block font-mono text-[10px] uppercase tracking-wider text-accent transition group-hover:text-accent-bright">
        Visit partner ↗
      </span>
    </a>
  );
}

export default async function PartnersDirectoryPage() {
  const viewer = await requireViewer();

  const partners = await loadPartnersForViewer(viewer);
  const featured = partners.filter((p) => p.tier === "FEATURED");
  const standard = partners.filter((p) => p.tier === "STANDARD");

  return (
    <div className="min-h-screen">
      <SiteHeader name={viewer.name} isAdmin={viewer.role === "ADMIN"} />

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-8">
        <section className="reveal reveal-1">
          <span className="pill">Partners</span>
          <h1 className="display-lg mt-4">
            Trusted <span className="glow-text">partners</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[17px] text-muted">
            The vendors and organizations we partner with to support
            investigators in the field. Curated, never intrusive — we only list
            partners we believe add real value to your work.
          </p>
        </section>

        {partners.length === 0 ? (
          <p className="panel mt-10 px-6 py-12 text-center text-muted">
            No partners listed yet. Check back soon.
          </p>
        ) : (
          <>
            {featured.length > 0 ? (
              <section className="reveal reveal-2 mt-10">
                <div className="flex items-center gap-3 border-b border-border pb-3">
                  <p className="eyebrow eyebrow-gold">Featured</p>
                  <span className="font-mono text-[11px] text-muted">
                    {String(featured.length).padStart(2, "0")}
                  </span>
                </div>
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {featured.map((p) => (
                    <PartnerCard key={p.id} p={p} />
                  ))}
                </div>
              </section>
            ) : null}

            {standard.length > 0 ? (
              <section className="reveal reveal-3 mt-12">
                <div className="flex items-center gap-3 border-b border-border pb-3">
                  <p className="eyebrow eyebrow-gold">Partners</p>
                  <span className="font-mono text-[11px] text-muted">
                    {String(standard.length).padStart(2, "0")}
                  </span>
                </div>
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {standard.map((p) => (
                    <PartnerCard key={p.id} p={p} />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}

        <p className="mt-14 text-[13px] text-muted">
          Interested in partnering with Investigator Network?{" "}
          <Link href="/dashboard" className="text-accent-bright hover:underline">
            Get in touch
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
