import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { ReactNode } from "react";

// Admin-only area: require an authenticated ADMIN session.
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  return <>{children}</>;
}
