import type { UnitType } from "@prisma/client";

export const UNIT_TYPES: {
  type: UnitType;
  label: string;
  description: string;
}[] = [
  { type: "VIDEO", label: "Video", description: "On-demand YouTube video" },
  { type: "NOTES", label: "Notes / eBook", description: "Interactive course notes" },
  {
    type: "LIVE_SESSION",
    label: "Live session (Teams)",
    description: "Instructor-led Microsoft Teams meeting",
  },
  {
    type: "FILE_ASSIGNMENT",
    label: "File assignment",
    description: "Learner uploads a document",
  },
  { type: "QUIZ", label: "Test / Quiz", description: "Graded assessment (Phase 5)" },
  {
    type: "CERTIFICATE",
    label: "Certificate",
    description: "Completion certificate",
  },
];

export const UNIT_LABEL: Record<UnitType, string> = Object.fromEntries(
  UNIT_TYPES.map((u) => [u.type, u.label])
) as Record<UnitType, string>;

export function defaultUnitData(type: UnitType): Record<string, unknown> {
  switch (type) {
    case "VIDEO":
      return { youtubeId: "", durationSec: 0 };
    case "NOTES":
      return { contentMarkdown: "" };
    case "LIVE_SESSION":
      return { teamsJoinUrl: "", startsAt: "", durationMin: 60, replayUrl: "" };
    case "FILE_ASSIGNMENT":
      return { prompt: "", allowedFileTypes: ".pdf,.doc,.docx" };
    case "CERTIFICATE":
      return { templateId: "default" };
    case "QUIZ":
      return {};
    default:
      return {};
  }
}
