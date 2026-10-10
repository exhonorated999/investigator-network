/**
 * Class board configuration — prisma-free so client components can import it.
 *
 * A course gets the slide-out Class Board (and loses the old overview-page
 * Q&A) when its slug is listed in BOARD_COURSES.
 */

export const BOARD_COURSES = new Set<string>(["cybertips-a-to-z"]);

export function boardEnabled(slug: string): boolean {
  return BOARD_COURSES.has(slug);
}

export type BoardKind = "INTRO" | "QUESTION" | "NEWS" | "RESOURCE";

export const BOARD_KINDS: {
  kind: BoardKind;
  label: string;
  plural: string;
  icon: string;
  hint: string;
}[] = [
  {
    kind: "INTRO",
    label: "Introduction",
    plural: "Introductions",
    icon: "👋",
    hint: "Introduce yourself to the class.",
  },
  {
    kind: "QUESTION",
    label: "Question",
    plural: "Questions",
    icon: "❓",
    hint: "Ask the instructor or the class — great for off-class days.",
  },
  {
    kind: "NEWS",
    label: "News / Win",
    plural: "News & wins",
    icon: "📰",
    hint: "Share an article or showcase a case win.",
  },
  {
    kind: "RESOURCE",
    label: "Resource",
    plural: "Resources",
    icon: "📎",
    hint: "Share a useful link or a small file with the class.",
  },
];

export function boardKindMeta(kind: string) {
  return BOARD_KINDS.find((k) => k.kind === kind) ?? BOARD_KINDS[1];
}

export function isBoardKind(v: string): v is BoardKind {
  return BOARD_KINDS.some((k) => k.kind === v);
}

/** Uploads shared on the board. */
export const BOARD_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const BOARD_FILE_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".zip",
];
export const BOARD_FILE_ACCEPT = BOARD_FILE_EXTENSIONS.join(",");

export const BOARD_MAX_BODY = 4000;
