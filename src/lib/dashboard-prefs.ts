import { prisma } from "@/lib/prisma";
import {
  DEFAULT_WIDGETS,
  PERMANENT_WIDGETS,
  WIDGETS,
  type WidgetId,
} from "@/lib/dashboard";

const VALID = new Set<string>(WIDGETS.map((w) => w.id));

/**
 * Optional widget ids the user has enabled, in registry order. Unknown ids
 * (removed widgets, hand-edited data) are ignored rather than throwing.
 */
export async function loadEnabledWidgets(userId: string): Promise<WidgetId[]> {
  const pref = await prisma.dashboardPref.findUnique({ where: { userId } });
  if (!pref) return DEFAULT_WIDGETS;

  const raw = Array.isArray(pref.widgets) ? (pref.widgets as unknown[]) : [];
  return raw
    .filter((v): v is string => typeof v === "string")
    .filter((v) => VALID.has(v) && !PERMANENT_WIDGETS.includes(v as WidgetId)) as WidgetId[];
}
