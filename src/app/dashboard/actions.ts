"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import {
  DEFAULT_WIDGETS,
  OPTIONAL_WIDGETS,
  type WidgetId,
} from "@/lib/dashboard";

const OPTIONAL_IDS = new Set<string>(OPTIONAL_WIDGETS.map((w) => w.id));

/**
 * Persists the learner's chosen optional widgets. Checkbox values arrive as
 * repeated `widget` entries; order follows the registry so the layout stays
 * predictable.
 */
export async function saveWidgets(formData: FormData) {
  const session = await requireUser();
  const userId = session.user!.id;

  const chosen = new Set(
    formData
      .getAll("widget")
      .filter((v): v is string => typeof v === "string")
      .filter((v) => OPTIONAL_IDS.has(v))
  );

  const widgets: WidgetId[] = OPTIONAL_WIDGETS.filter((w) => chosen.has(w.id)).map(
    (w) => w.id
  );

  await prisma.dashboardPref.upsert({
    where: { userId },
    create: { userId, widgets },
    update: { widgets },
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
    create: { userId, widgets: DEFAULT_WIDGETS, newsTopics },
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
