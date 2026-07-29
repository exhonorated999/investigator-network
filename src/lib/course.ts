import { prisma } from "@/lib/prisma";
import type { Prisma, UnitType } from "@prisma/client";

/**
 * Course loaded with ordered sections + units, plus a per-user progress map
 * and a flat ordered list of units for prev/next navigation.
 */

const courseInclude = {
  category: true,
  sections: {
    orderBy: { order: "asc" },
    include: {
      units: {
        orderBy: { order: "asc" },
      },
    },
  },
} satisfies Prisma.CourseInclude;

export type LoadedCourse = Prisma.CourseGetPayload<{ include: typeof courseInclude }>;
export type LoadedUnit = LoadedCourse["sections"][number]["units"][number];

export async function loadCourseBySlug(slug: string): Promise<LoadedCourse | null> {
  return prisma.course.findUnique({
    where: { slug },
    include: courseInclude,
  });
}

/** Flat ordered list of units across all sections. */
export function flattenUnits(course: LoadedCourse): LoadedUnit[] {
  return course.sections.flatMap((s) => s.units);
}

/** Map unitId -> COMPLETE for a given user across the course's units. */
export async function progressMap(
  userId: string,
  course: LoadedCourse
): Promise<Set<string>> {
  const unitIds = flattenUnits(course).map((u) => u.id);
  if (unitIds.length === 0) return new Set();
  const rows = await prisma.unitProgress.findMany({
    where: { userId, unitId: { in: unitIds }, status: "COMPLETE" },
    select: { unitId: true },
  });
  return new Set(rows.map((r) => r.unitId));
}

export function percentComplete(course: LoadedCourse, completed: Set<string>): number {
  const units = flattenUnits(course);
  if (units.length === 0) return 0;
  return Math.round((completed.size / units.length) * 100);
}

/** Prev/next unit ids for player navigation. */
export function neighbors(
  course: LoadedCourse,
  unitId: string
): { prevId: string | null; nextId: string | null; index: number; total: number } {
  const units = flattenUnits(course);
  const index = units.findIndex((u) => u.id === unitId);
  return {
    prevId: index > 0 ? units[index - 1].id : null,
    nextId: index >= 0 && index < units.length - 1 ? units[index + 1].id : null,
    index,
    total: units.length,
  };
}

/** Typed accessor for a unit's JSON payload. */
export function unitData(unit: { data: unknown }): Record<string, unknown> {
  return (unit.data as Record<string, unknown>) ?? {};
}

export const UNIT_ICON: Record<UnitType, string> = {
  VIDEO: "▶",
  NOTES: "📄",
  LIVE_SESSION: "📡",
  FILE_ASSIGNMENT: "📎",
  QUIZ: "✎",
  CERTIFICATE: "🏅",
};
