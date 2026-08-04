import { requireUser } from "@/lib/rbac";
import type { ReactNode } from "react";
import { PreviewBanner } from "@/components/preview-banner";

// Any signed-in session already implies an APPROVED user (enforced in authorize()).
// requireUser also bounces accounts still on a temporary password.
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireUser();
  return (
    <>
      <PreviewBanner />
      {children}
    </>
  );
}
