/**
 * Shared prose styling for markdown output.
 *
 * A single Tailwind arbitrary-variant string used by every renderer that
 * displays marked HTML — richText, callout bodies, table, email, etc.
 * Extracted from unit-view.tsx so there is one copy.
 */
export const PROSE =
  "panel rule-top max-w-none p-6 text-foreground [&_a]:text-accent [&_a]:underline [&_a]:transition [&_a:hover]:text-accent-bright [&_blockquote]:border-l-2 [&_blockquote]:border-accent/40 [&_blockquote]:pl-4 [&_blockquote]:text-muted [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_code]:text-accent-bright [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:uppercase [&_h1]:tracking-wide [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-accent-bright [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wide [&_li]:my-1 [&_li]:relative [&_li]:pl-5 [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:text-accent [&_li]:before:content-['▸'] [&_p]:my-3 [&_p]:max-w-[68ch] [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-well-strong [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-sm [&_strong]:text-foreground [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-border [&_th]:bg-surface-2 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-display [&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-[0.14em] [&_th]:text-accent-bright [&_ul]:my-3 [&_ul]:list-none";

/**
 * A lighter variant for inline prose contexts (callout bodies, email bodies)
 * where the full panel treatment is too heavy — no panel background, no top
 * rule, just the typographic styling.
 */
export const PROSE_INLINE =
  "text-foreground [&_a]:text-accent [&_a]:underline [&_a]:transition [&_a:hover]:text-accent-bright [&_blockquote]:border-l-2 [&_blockquote]:border-accent/40 [&_blockquote]:pl-4 [&_blockquote]:text-muted [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_code]:text-accent-bright [&_h1]:mb-3 [&_h1]:mt-4 [&_h1]:font-display [&_h1]:text-xl [&_h1]:font-bold [&_h1]:uppercase [&_h1]:tracking-wide [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-accent-bright [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wide [&_li]:my-1 [&_li]:relative [&_li]:pl-5 [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:text-accent [&_li]:before:content-['▸'] [&_p]:my-2 [&_p]:max-w-[68ch] [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-well-strong [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-sm [&_strong]:text-foreground [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-border [&_th]:bg-surface-2 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-display [&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-[0.14em] [&_th]:text-accent-bright [&_ul]:my-2 [&_ul]:list-none";
