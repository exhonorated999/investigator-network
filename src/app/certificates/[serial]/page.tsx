import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { requireViewer } from "@/lib/viewer";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ serial: string }>;
}) {
  await requireUser();
  const { serial } = await params;
  const viewer = await requireViewer();

  const cert = await prisma.certificate.findUnique({
    where: { serial },
    include: { user: true, course: true },
  });
  if (!cert) notFound();

  // Only the owner (or the previewing admin) may view.
  const isOwner = cert.userId === viewer.id;
  const isAdmin = viewer.realAdminId != null;
  if (!isOwner && !isAdmin) notFound();

  const issued = cert.issuedAt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link
            href="/dashboard"
            className="eyebrow eyebrow-muted transition hover:text-accent-bright"
          >
            ← Back to my training
          </Link>
          <PrintButton />
        </div>

        <div className="bracket relative overflow-hidden border-2 border-gold/40 bg-surface p-10 text-center shadow-2xl sm:p-14">
          {/* radial glow */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_30%,rgba(0,180,216,0.1),transparent_70%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_50%_80%,rgba(244,162,97,0.06),transparent_70%)]" />
          </div>

          {/* gold hairline double border */}
          <div className="pointer-events-none absolute inset-3 border border-gold/20" />

          <div className="relative">
            <Image
              src="/brand/logo.png"
              alt="Investigator Network"
              width={72}
              height={72}
              className="mx-auto transition group-hover:drop-shadow-[0_0_12px_rgba(0,180,216,0.6)]"
            />

            <p className="mt-5 font-display text-xs font-bold uppercase tracking-[0.4em] text-gold">
              Certificate of Completion
            </p>

            <div className="mx-auto mt-8 h-px w-24 bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

            <p className="mt-8 text-sm uppercase tracking-[0.2em] text-muted">
              This certifies that
            </p>
            <h1 className="display-lg mt-3 text-foreground">
              {cert.user.name}
            </h1>
            {cert.user.agency ? (
              <p className="mt-2 text-sm text-muted">{cert.user.agency}</p>
            ) : null}

            <p className="mt-8 text-sm uppercase tracking-[0.2em] text-muted">
              has successfully completed
            </p>
            <h2 className="display-sm mt-3 glow-text">
              {cert.course.title}
            </h2>
            {cert.course.trainingHours != null ? (
              <p className="mt-3 font-mono text-xs uppercase tracking-[0.2em] text-accent-bright">
                {formatHours(cert.course.trainingHours)} training hours
              </p>
            ) : null}

            <div className="mx-auto mt-10 grid max-w-lg grid-cols-2 gap-6 border-t border-border pt-5 text-left sm:grid-cols-3">
              <div>
                <p className="eyebrow eyebrow-muted text-[9px]">Date of completion</p>
                <p className="mt-1 text-sm text-foreground">{issued}</p>
              </div>
              <div>
                <p className="eyebrow eyebrow-muted text-[9px]">Instructor</p>
                <p className="mt-1 text-sm text-foreground">
                  {cert.course.instructor || "Investigator Network"}
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1 sm:text-right">
                <p className="eyebrow eyebrow-muted text-[9px]">Credential ID</p>
                <p className="mt-1 font-mono text-[11px] text-muted">{cert.serial}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** "8" / "1.5" — drop a trailing ".0" so whole hours read cleanly. */
function formatHours(h: number): string {
  return Number.isInteger(h) ? String(h) : String(h);
}
