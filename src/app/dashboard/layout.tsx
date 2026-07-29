import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { ReactNode } from "react";

// Any signed-in session already implies an APPROVED user (enforced in authorize()).
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <>{children}</>;
}
