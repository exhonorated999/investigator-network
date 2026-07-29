import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { requireUser } from "@/lib/rbac";
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
  const session = await auth();

  const cert = await prisma.certificate.findUnique({
    where: { serial },
    include: { user: true, course: true },
  });
  if (!cert) notFound();

  // Only the owner or an admin may view.
  const isOwner = cert.userId === session!.user.id;
  const isAdmin = session!.user.role === "ADMIN";
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
          <Link href="/dashboard" className="text-sm text-accent hover:underline">
            ← Back to my training
          </Link>
          <PrintButton />
        </div>

        <div className="relative overflow-hidden rounded-2xl border-2 border-gold/50 bg-surface p-10 text-center shadow-2xl">
          <div className="pointer-events-none absolute inset-0 opacity-[0.04]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--accent),transparent_60%)]" />
          </div>

          <div className="relative">
            <Image
              src="/brand/logo.png"
              alt="Investigator Network"
              width={72}
              height={72}
              className="mx-auto"
            />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.3em] text-gold">
              Certificate of Completion
            </p>

            <p className="mt-8 text-sm text-muted">This certifies that</p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">
              {cert.user.name}
            </h1>
            <p className="mt-1 text-sm text-muted">{cert.user.agency}</p>

            <p className="mt-6 text-sm text-muted">has successfully completed</p>
            <h2 className="mt-2 text-xl font-semibold text-accent">
              {cert.course.title}
            </h2>

            <div className="mx-auto mt-10 flex max-w-md items-center justify-between border-t border-border pt-4 text-xs text-muted">
              <span>Issued {issued}</span>
              <span className="font-mono">{cert.serial}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
