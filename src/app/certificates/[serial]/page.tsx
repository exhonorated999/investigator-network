import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { getViewerUser } from "@/lib/viewer";
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
  const viewer = (await getViewerUser())!;

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

            <div className="mx-auto mt-10 flex max-w-md items-center justify-between border-t border-border pt-4">
              <span className="text-xs text-muted">Issued {issued}</span>
              <span className="font-mono text-xs text-muted">{cert.serial}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
