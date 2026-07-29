import { requireUser } from "@/lib/rbac";

export default async function CoursesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return <>{children}</>;
}
