/**
 * Dashboard widget registry — pure data, safe to import from client
 * components. The Prisma-backed loader lives in `lib/dashboard-prefs.ts`.
 */
export type WidgetId =
  | "courses"
  | "notifications"
  | "stats"
  | "resources"
  | "news"
  | "messages"
  | "network";

export interface WidgetMeta {
  id: WidgetId;
  label: string;
  description: string;
  /** Column span on the 6-column desktop grid. */
  span: 2 | 3 | 4 | 6;
  permanent?: boolean;
  comingSoon?: boolean;
}

export const WIDGETS: WidgetMeta[] = [
  {
    id: "courses",
    label: "Course library",
    description: "Album view of assigned, available and completed training.",
    span: 4,
    permanent: true,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Live sessions, test results and new credentials.",
    span: 2,
    permanent: true,
  },
  {
    id: "stats",
    label: "Progress snapshot",
    description: "Units completed, active courses, certificates, pass rate.",
    span: 6,
  },
  {
    id: "resources",
    label: "Tools & resources",
    description: "Reference material and investigative tools.",
    span: 2,
  },
  {
    id: "news",
    label: "News feed",
    description: "Curated articles from staff in the topics you follow.",
    span: 3,
  },
  {
    id: "messages",
    label: "Messages",
    description: "Direct messages from instructors and administrators.",
    span: 3,
    comingSoon: true,
  },
  {
    id: "network",
    label: "Network activity",
    description: "What other investigators are completing.",
    span: 3,
    comingSoon: true,
  },
];

export const PERMANENT_WIDGETS: WidgetId[] = WIDGETS.filter((w) => w.permanent).map(
  (w) => w.id
);

export const OPTIONAL_WIDGETS: WidgetMeta[] = WIDGETS.filter((w) => !w.permanent);

export const DEFAULT_WIDGETS: WidgetId[] = [
  "stats",
  "news",
  "resources",
];

/**
 * Old ids kept working after a rename so saved layouts survive.
 * `announcements` was the pre-Phase-8 name of the news feed.
 */
export const WIDGET_ALIASES: Record<string, WidgetId> = {
  announcements: "news",
};

const VALID = new Set<string>(WIDGETS.map((w) => w.id));

export function widgetMeta(id: WidgetId): WidgetMeta {
  return WIDGETS.find((w) => w.id === id)!;
}

export function isWidgetId(value: string): boolean {
  return VALID.has(value);
}

export const SPAN_CLASS: Record<WidgetMeta["span"], string> = {
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  6: "lg:col-span-6",
};
