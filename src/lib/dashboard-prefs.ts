import { prisma } from "@/lib/prisma";
import {
  DEFAULT_CARDS,
  DEFAULT_LAYOUT,
  DEFAULT_WIDGETS,
  MAX_CARDS,
  PERMANENT_WIDGETS,
  SLOTS,
  WIDGETS,
  WIDGET_ALIASES,
  defaultSpanFor,
  isSlotChoice,
  normalizeSpan,
  type DashCard,
  type SlotChoice,
  type WidgetId,
} from "@/lib/dashboard";

const VALID = new Set<string>(WIDGETS.map((w) => w.id));

/**
 * The learner's card canvas — a free-form list of `{ choice, span }`. Two
 * on-disk shapes are supported so old data keeps working:
 *   • new: `[{ c, s }, …]` — the current format written by the card actions.
 *   • legacy: `["stats", "news", …]` — the fixed-slot layout; each non-empty
 *     entry becomes a card at the widget's natural (normalized) width.
 * Unknown/removed widget ids and pinned widgets (courses/notifications) are
 * dropped rather than throwing.
 */
export async function loadCards(userId: string): Promise<DashCard[]> {
  const pref = await prisma.dashboardPref.findUnique({ where: { userId } });
  const raw = pref && Array.isArray(pref.widgets) ? (pref.widgets as unknown[]) : null;
  if (!raw || raw.length === 0) return [...DEFAULT_CARDS];

  const cards: DashCard[] = [];
  for (const entry of raw) {
    // New object shape: { c: choice, s: span }.
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const rec = entry as Record<string, unknown>;
      const rawChoice = typeof rec.c === "string" ? rec.c : "";
      const choice = (WIDGET_ALIASES[rawChoice] ?? rawChoice) as string;
      if (choice === "empty") {
        cards.push({ choice: "empty", span: normalizeSpan(rec.s) });
      } else if (isSlotChoice(choice) && choice !== "courses" && choice !== "notifications") {
        cards.push({ choice: choice as SlotChoice, span: normalizeSpan(rec.s) });
      }
      continue;
    }
    // Legacy string shape: a bare SlotChoice per fixed slot.
    if (typeof entry === "string") {
      const choice = (WIDGET_ALIASES[entry] ?? entry) as string;
      if (choice === "empty" || choice === "courses" || choice === "notifications") continue;
      if (isSlotChoice(choice)) {
        cards.push({ choice: choice as SlotChoice, span: defaultSpanFor(choice as SlotChoice) });
      }
    }
  }

  if (cards.length === 0) return [...DEFAULT_CARDS];
  return cards.slice(0, MAX_CARDS);
}

/** Persist a card list (already validated by the caller). */
export async function saveCards(userId: string, cards: DashCard[]): Promise<void> {
  const widgets = cards.slice(0, MAX_CARDS).map((c) => ({ c: c.choice, s: c.span }));
  await prisma.dashboardPref.upsert({
    where: { userId },
    create: { userId, widgets },
    update: { widgets },
  });
}

/**
 * The learner's slot layout: one choice per fixed slot, in slot order. Stored
 * in `DashboardPref.widgets`. Any stored array whose length doesn't match the
 * current slot count (e.g. pre-slots data) is treated as "no pref" so the
 * default layout is used; individual invalid entries fall back per-slot.
 */
export async function loadLayout(userId: string): Promise<SlotChoice[]> {
  const pref = await prisma.dashboardPref.findUnique({ where: { userId } });
  const layout = [...DEFAULT_LAYOUT];

  const raw = pref && Array.isArray(pref.widgets) ? (pref.widgets as unknown[]) : null;
  // Accept saved layouts up to the current slot count. Older layouts saved
  // before a slot was appended (e.g. the Partner Spotlight) are shorter than
  // SLOTS — we preserve their existing choices by index and let any new,
  // unspecified slots fall back to DEFAULT_LAYOUT rather than resetting the
  // whole dashboard.
  if (raw && raw.length > 0 && raw.length <= SLOTS.length) {
    for (let i = 0; i < SLOTS.length; i++) {
      const v = raw[i];
      if (typeof v !== "string" || !isSlotChoice(v)) continue;
      // `courses`/`notifications` are now pinned above the canvas; if an old
      // saved layout still references them in a slot, blank that slot.
      layout[i] = v === "courses" || v === "notifications" ? "empty" : v;
    }
  }
  return layout;
}

/**
 * Optional widget ids the user has enabled, in registry order. Renamed ids are
 * mapped through `WIDGET_ALIASES`; unknown ids (removed widgets, hand-edited
 * data) are ignored rather than throwing.
 */
export async function loadEnabledWidgets(userId: string): Promise<WidgetId[]> {
  const pref = await prisma.dashboardPref.findUnique({ where: { userId } });
  if (!pref) return DEFAULT_WIDGETS;

  const raw = Array.isArray(pref.widgets) ? (pref.widgets as unknown[]) : [];
  const ids = new Set(
    raw
      .filter((v): v is string => typeof v === "string")
      .map((v) => WIDGET_ALIASES[v] ?? v)
      .filter((v) => VALID.has(v) && !PERMANENT_WIDGETS.includes(v as WidgetId))
  );

  // Registry order, not save order, so the grid never reshuffles unexpectedly.
  return WIDGETS.filter((w) => ids.has(w.id)).map((w) => w.id);
}
