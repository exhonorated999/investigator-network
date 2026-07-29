"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { sendApprovalEmail, sendDenialEmail } from "@/lib/email";

function refresh() {
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function approveUser(formData: FormData) {
  const session = await requireAdmin();
  const userId = String(formData.get("userId"));

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedById: session.user.id,
    },
  });

  await sendApprovalEmail(user.email, user.name);
  refresh();
}

export async function denyUser(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId"));

  const user = await prisma.user.update({
    where: { id: userId },
    data: { status: "DENIED" },
  });

  await sendDenialEmail(user.email, user.name);
  refresh();
}

export async function suspendUser(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId"));
  await prisma.user.update({
    where: { id: userId },
    data: { status: "SUSPENDED" },
  });
  refresh();
}

export async function reactivateUser(formData: FormData) {
  const session = await requireAdmin();
  const userId = String(formData.get("userId"));
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedById: session.user.id,
    },
  });
  await sendApprovalEmail(user.email, user.name);
  refresh();
}
