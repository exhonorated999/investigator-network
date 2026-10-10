/**
 * End-of-course evaluation questions, defined per course slug. Prisma-free so
 * the client form can import it. A course listed here REQUIRES the evaluation
 * before its certificate is issued (see maybeIssueCertificate).
 *
 * Answers are stored on CourseEvaluation.answers keyed by question id; the
 * testimonial question is stored in its own columns (testimonialOk/testimonial)
 * so admins can pull quotable testimonials easily.
 */

export type EvalQuestion =
  | { id: string; kind: "stars"; label: string }
  | { id: string; kind: "yesno"; label: string }
  | { id: string; kind: "text"; label: string; required?: boolean };

export interface EvaluationConfig {
  questions: EvalQuestion[];
  /** Ask "would you write a short testimonial?" (Yes reveals a text box). */
  testimonial?: { label: string };
}

export const COURSE_EVALUATIONS: Record<string, EvaluationConfig> = {
  "cybertips-a-to-z": {
    questions: [
      { id: "overallValue", kind: "stars", label: "Overall value of the course" },
      { id: "instructorKnowledge", kind: "stars", label: "Instructor knowledge" },
      {
        id: "courseFormat",
        kind: "stars",
        label: "Course format (3 non-consecutive days)",
      },
      {
        id: "viperUsefulness",
        kind: "stars",
        label: "How useful was Project V.I.P.E.R. to your investigations?",
      },
      { id: "recommend", kind: "yesno", label: "Would you recommend this course?" },
      { id: "liked", kind: "text", label: "What did you like about the course?" },
      { id: "changes", kind: "text", label: "What should be changed or added?" },
    ],
    testimonial: {
      label:
        "Would you be willing to write a short testimonial for our course? (We won't use names.)",
    },
  },
};

export function evaluationFor(slug: string): EvaluationConfig | null {
  return COURSE_EVALUATIONS[slug] ?? null;
}

export const STAR_LABELS = ["Poor", "Fair", "Good", "Very good", "Excellent"];
