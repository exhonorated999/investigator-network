import { prisma } from "@/lib/prisma";
import {
  DEFAULT_LAYOUT,
  DEFAULT_WIDGETS,
  PERMANENT_WIDGETS,
  SLOTS,
  WIDGETS,
  WIDGET_ALIASES,
  isSlotChoice,
  type SlotChoice,
  type WidgetId,
} from "@/lib/dashboard";

const VALID = new Set<string>(WIDGETS.map((w) => w.id));

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
  if (raw && raw.length === SLOTS.length) {
    for (let i = 0; i < SLOTS.length; i++) {
      const v = raw[i];
      if (typeof v === "string" && isSlotChoice(v)) layout[i] = v;
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
