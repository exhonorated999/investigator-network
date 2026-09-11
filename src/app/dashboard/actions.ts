"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { requireViewer } from "@/lib/viewer";
import {
  DEFAULT_LAYOUT,
  MAX_CARDS,
  defaultSpanFor,
  isSlotChoice,
  normalizeSpan,
} from "@/lib/dashboard";
import { loadCards, saveCards } from "@/lib/dashboard-prefs";

/**
 * Card actions operate on the *effective viewer* (not the raw signed-in user)
 * so edits match what the dashboard renders — important when an admin previews
 * as a learner. Each action loads the current card list, mutates it, and saves.
 */

/** Append a new empty card (the learner then picks a widget for it). */
export async function addCard() {
  const viewer = await requireViewer();
  const cards = await loadCards(viewer.id);
  if (cards.length >= MAX_CARDS) return;
  cards.push({ choice: "empty", span: 2 });
  await saveCards(viewer.id, cards);
  revalidatePath("/dashboard");
}

/** Remove the card at `index`. */
export async function removeCard(formData: FormData) {
  const viewer = await requireViewer();
  const index = Number(formData.get("index"));
  const cards = await loadCards(viewer.id);
  if (!Number.isInteger(index) || index < 0 || index >= cards.length) return;
  cards.splice(index, 1);
  await saveCards(viewer.id, cards);
  revalidatePath("/dashboard");
}

/** Change which widget the card at `index` shows. */
export async function setCardWidget(formData: FormData) {
  const viewer = await requireViewer();
  const index = Number(formData.get("index"));
  const choice = String(formData.get("choice") ?? "empty");
  if (!isSlotChoice(choice)) return;

  const cards = await loadCards(viewer.id);
  if (!Number.isInteger(index) || index < 0 || index >= cards.length) return;
  // Adopt the widget's natural width the first time it's picked into an empty
  // card, so a fresh card lands at a sensible size; keep the size otherwise.
  const wasEmpty = cards[index].choice === "empty";
  cards[index].choice = choice;
  if (wasEmpty && choice !== "empty") cards[index].span = defaultSpanFor(choice);
  await saveCards(viewer.id, cards);
  revalidatePath("/dashboard");
}

/** Resize the card at `index` (Full / Half / Third). */
export async function setCardSpan(formData: FormData) {
  const viewer = await requireViewer();
  const index = Number(formData.get("index"));
  const span = normalizeSpan(formData.get("span"));

  const cards = await loadCards(viewer.id);
  if (!Number.isInteger(index) || index < 0 || index >= cards.length) return;
  cards[index].span = span;
  await saveCards(viewer.id, cards);
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
