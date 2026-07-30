import { prisma } from "@/lib/prisma";
import {
  DEFAULT_WIDGETS,
  PERMANENT_WIDGETS,
  WIDGETS,
  WIDGET_ALIASES,
  type WidgetId,
} from "@/lib/dashboard";

const VALID = new Set<string>(WIDGETS.map((w) => w.id));

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
