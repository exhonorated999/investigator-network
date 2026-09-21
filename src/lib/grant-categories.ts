// Client-safe grant metadata. This module intentionally imports NOTHING at
// runtime (only an erased `import type`) so it can be pulled into client
// components (e.g. the admin grant form) WITHOUT dragging the Prisma client
// into the browser bundle. Keep prisma-importing code in `@/lib/grants`.
import type { GrantCategory } from "@/generated/prisma";

export const GRANT_CATEGORY_LABEL: Record<GrantCategory, string> = {
  INVESTIGATIONS: "Investigations software",
  DFIR: "DFIR (Datapilot)",
  SO_SYMPOSIUM: "SO-management symposium",
};

/** Order the chips are offered/rendered in. */
export const GRANT_CATEGORIES: GrantCategory[] = [
  "INVESTIGATIONS",
  "DFIR",
  "SO_SYMPOSIUM",
];
