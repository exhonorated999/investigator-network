"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { requireViewer } from "@/lib/viewer";
import { DEFAULT_LAYOUT, SLOTS, isSlotChoice } from "@/lib/dashboard";
import { loadLayout } from "@/lib/dashboard-prefs";

/**
 * Sets a single dashboard slot to a chosen widget (or "empty"). The picker in
 * each card posts `index` + `choice`; we load the current layout, patch the one
 * slot, and persist the whole array.
 *
 * Uses the *effective viewer* (not the raw signed-in user) so the write matches
 * what the dashboard renders. Otherwise, when an admin is previewing as a
 * learner, the change would save to the admin's own prefs and the previewed
 * dashboard would appear to do nothing.
 */
export async function setSlot(formData: FormData) {
  const viewer = await requireViewer();
  const userId = viewer.id;

  const index = Number(formData.get("index"));
  const choice = String(formData.get("choice") ?? "empty");
  if (!Number.isInteger(index) || index < 0 || index >= SLOTS.length) return;
  if (!isSlotChoice(choice)) return;

  const layout = await loadLayout(userId);
  layout[index] = choice;

  await prisma.dashboardPref.upsert({
    where: { userId },
    create: { userId, widgets: layout },
    update: { widgets: layout },
  });

  revalidatePath("/dashboard");
}

/**
 * Persists which news topics the learner follows. An empty selection is stored
 * as `[]`, which the feed reads as "follow everything".
 */
export async function saveNewsTopics(formData: FormData) {
  const session = await requireUser();
  const userId = session.user!.id;

  const requested = formData
    .getAll("topic")
    .filter((v): v is string => typeof v === "string");

  // Only keep ids that still exist, so deleted categories drop out silently.
  const known =
    requested.length > 0
      ? await prisma.category.findMany({
          where: { id: { in: requested } },
          select: { id: true },
        })
      : [];
  const newsTopics = known.map((c) => c.id);

  await prisma.dashboardPref.upsert({
    where: { userId },
    create: { userId, widgets: DEFAULT_LAYOUT, newsTopics },
    update: { newsTopics },
  });

  revalidatePath("/dashboard");
  revalidatePath("/news");
}

/** Star / unstar a course. */
export async function toggleFavorite(formData: FormData) {
  const session = await requireUser();
  const userId = session.user!.id;
  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) return;

  const existing = await prisma.courseFavorite.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });

  if (existing) {
    await prisma.courseFavorite.delete({ where: { id: existing.id } });
  } else {
    await prisma.courseFavorite.create({ data: { userId, courseId } });
  }

  revalidatePath("/dashboard");
  const slug = String(formData.get("slug") ?? "");
  if (slug) revalidatePath(`/courses/${slug}`);
}
