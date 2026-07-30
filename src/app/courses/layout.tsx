import { requireUser } from "@/lib/rbac";
import { PreviewBanner } from "@/components/preview-banner";
import { PlayerDockProvider } from "@/components/course-player-dock";

export default async function CoursesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return (
    <PlayerDockProvider>
      <PreviewBanner />
      {children}
    </PlayerDockProvider>
  );
}
