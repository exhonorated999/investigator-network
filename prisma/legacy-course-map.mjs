/**
 * Legacy LearnWorlds → Investigator Network course mapping.
 *
 * Keys are the course slugs found in the `courses` column of the LearnWorlds
 * user export. Values are slugs of courses that exist on this platform.
 *
 * Anything not listed here is intentionally NOT migrated — either the course
 * has no equivalent here yet, or granting it would be wrong (see SKIP notes).
 * The importer reports every unmapped slug with a headcount so nothing is lost
 * silently.
 */
export const LEGACY_COURSE_MAP = {
  "datapilot-scout": "datapilot-scout",
  "datapilot-10-essentials": "datapilot-dpx-dp10-essentials",
  "basics-of-datapilot-desktop": "datapilot-desktop-essentials",
  "project-viper": "project-v-i-p-e-r",
  "meta-quest-forensic-foundations-datapilot-powered-evidence-recovery":
    "meta-quest-forensic-foundations",
};

/**
 * Legacy slugs we deliberately drop, with the reason. Listed explicitly so the
 * report can separate "decided against" from "nothing built yet".
 *
 * The ICAC / cybertip entries matter most: the new `cybertips-a-to-z` is a paid
 * 2026 mentorship cohort with live Teams dates, not a reissue of the old
 * on-demand course. Legacy holders must not be granted a seat in it.
 */
export const LEGACY_COURSE_SKIP = {
  "icac-a-to-z": "New Cybertips A to Z is a paid 2026 cohort — do not grant.",
  "icac-a-to-z-spring-2024":
    "New Cybertips A to Z is a paid 2026 cohort — do not grant.",
  "cybertip-investigations-a-to-z-part-1":
    "New Cybertips A to Z is a paid 2026 cohort — do not grant.",
  "cybertip-investigations-a-to-z-part-2":
    "New Cybertips A to Z is a paid 2026 cohort — do not grant.",
  "cybertip-investigations-a-to-z-part-3":
    "New Cybertips A to Z is a paid 2026 cohort — do not grant.",
};
