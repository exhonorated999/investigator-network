import { requireUser } from "@/lib/rbac";
import { PreviewBanner } from "@/components/preview-banner";

export default async function NewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return (
    <>
      <PreviewBanner />
      {children}
    </>
  );
}
