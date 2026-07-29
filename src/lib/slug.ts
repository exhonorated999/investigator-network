export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Ensure uniqueness by appending a short suffix when needed. */
export function withSuffix(base: string, suffix: number): string {
  return suffix <= 0 ? base : `${base}-${suffix}`;
}
