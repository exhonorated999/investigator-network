import Link from "next/link";
import { requireViewer } from "@/lib/viewer";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export default async function CertificatesPage() {
  const viewer = await requireViewer();
  const isAdmin = viewer.role === "ADMIN";

  const certificates = await prisma.certificate.findMany({
    where: { userId: viewer.id },
    orderBy: { issuedAt: "desc" },
    include: { course: { select: { title: true, trainingHours: true } } },
  });

  return (
    <div className="min-h-screen">
      <SiteHeader name={viewer.name} isAdmin={isAdmin} />

      <main className="mx-auto max-w-5xl px-5 pb-20 pt-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="eyebrow eyebrow-gold">// Credentials</p>
            <h1 className="display-lg mt-2">My certificates</h1>
            <p className="mt-2 text-[15px] text-muted">
              Every certificate you&apos;ve earned. Open one to view, print, or
              save it as a PDF.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="eyebrow eyebrow-muted transition hover:text-accent-bright"
          >
            ← Back to dashboard
          </Link>
        </div>

        {certificates.length === 0 ? (
          <div className="bracket border border-border bg-surface p-10 text-center">
            <p className="text-muted">
              No certificates yet. Complete a course to earn your first one.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-block eyebrow eyebrow-muted transition hover:text-accent-bright"
            >
              Browse courses →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {certificates.map((cert) => {
              const issued = cert.issuedAt.toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              });
              return (
                <Link
                  key={cert.id}
                  href={`/certificates/${cert.serial}`}
                  className="bracket group relative overflow-hidden border border-gold/30 bg-surface p-6 transition hover:border-gold/60"
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_20%,rgba(244,162,97,0.06),transparent_70%)]" />
                  <div className="relative">
                    <p className="eyebrow eyebrow-gold text-[9px]">
                      Certificate of completion
                    </p>
                    <h2 className="mt-3 font-display text-xl font-black leading-tight text-foreground">
                      {cert.course.title}
                    </h2>
                    <div className="mt-5 flex items-end justify-between border-t border-border pt-4">
                      <div>
                        <p className="eyebrow eyebrow-muted text-[9px]">
                          Issued
                        </p>
                        <p className="mt-1 text-sm text-foreground">{issued}</p>
                        {cert.course.trainingHours != null ? (
                          <p className="mt-1 font-mono text-[11px] text-accent-bright">
                            {cert.course.trainingHours} training hours
                          </p>
                        ) : null}
                      </div>
                      <span className="eyebrow eyebrow-muted transition group-hover:text-gold">
                        View &amp; download ↗
                      </span>
                    </div>
                    <p className="mt-3 font-mono text-[10px] text-muted">
                      {cert.serial}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
