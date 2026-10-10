"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";

export type ViperField = "requested" | "shipped" | "digital";

/**
 * Toggle a VIPER hard-drive status box on one enrollment. Marking a drive
 * shipped also marks it requested (you can't ship what wasn't requested).
 * "digital" = student uses the digital download; no drive needs to ship.
 */
export async function setViperStatus(
  enrollmentId: string,
  field: ViperField,
  checked: boolean
): Promise<void> {
  await requireAdmin();
  const now = new Date();
  if (field === "digital") {
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { viperDigitalAt: checked ? now : null },
    });
    revalidatePath("/admin/metrics");
    return;
  }
  const data =
    field === "requested"
      ? { viperRequestedAt: checked ? now : null }
      : checked
        ? { viperShippedAt: now }
        : { viperShippedAt: null };

  const current = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { viperRequestedAt: true },
  });
  if (!current) return;

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data:
      field === "shipped" && checked && !current.viperRequestedAt
        ? { ...data, viperRequestedAt: now }
        : data,
  });
  revalidatePath("/admin/metrics");
}

/** Save (or clear) the shipment tracking number for one enrollment. */
export async function setViperTracking(enrollmentId: string, tracking: string): Promise<void> {
  await requireAdmin();
  const value = tracking.trim().slice(0, 120);
  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { viperTracking: value || null },
  });
  revalidatePath("/admin/metrics");
}
