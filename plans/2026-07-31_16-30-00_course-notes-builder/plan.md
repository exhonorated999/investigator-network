# Interactive Course Notes builder

## Context

`NOTES` units today are a single markdown blob plus one optional iframe embed
(`src/lib/units.ts` → `defaultUnitData("NOTES")` returns
`{ contentMarkdown, embedUrl, embedHeight, embedTitle }`). The learner renderer
(`src/components/unit-view.tsx`, the `unit.type === "NOTES"` branch) parses the
markdown with `marked` and stacks one `DocEmbed` above one `<article>`.

That is enough for a text page and nothing else. The user wants a real
document builder — comparable to the LearnWorlds "ebook" section library —
with embedded PDFs, flipbooks, YouTube, email artifacts, plus layout and
interactive primitives (accordions, columns, tabs).

Two requirements pull in different directions and must both be satisfied:

1. **Robust + visual** — an admin can compose a rich page by clicking.
2. **Not gated by the UI** — the agent must be able to author a complete notes
   document from a conversation without being limited to whatever fields the
   editor happens to expose.

Requirement 2 is the one that drives the architecture: the source of truth has
to be a plain, documented data structure that can be written directly, with the
visual editor as *one* client of it rather than the only way in.

## Scope & Non-Goals

### In scope (v1)
- A recursive **block document** stored on `Unit.data.blocks`.
- A learner-side **block renderer** (server components).
- An admin-side **block editor**: add / reorder / delete / edit blocks.
- A **JSON source view** on the unit editor — paste in or copy out the whole
  document. This is the agent's authoring path and the escape hatch.
- Asset uploads (PDF, images) reusing the existing `FileUpload` + `lib/storage`
  + `/api/files/[id]` pipeline already proven by the cover-image work.

### Explicitly deferred
- Drag-and-drop reordering (up/down buttons first; DnD is a later polish pass).
- Reusable "template sections" / cross-course block libraries.
- SCORM / LTI packages.
- Per-block visibility rules or drip scheduling.
- Applying blocks to unit types other than `NOTES`.

## Architecture

### Data model — no migration required

`Unit.data` is already `Json`. The new shape:

```jsonc
{
  "version": 1,
  "blocks": [ { "id": "b1", "type": "callout", "...": "..." } ],
  // legacy fields stay readable so existing NOTES units keep rendering
  "contentMarkdown": "",
  "embedUrl": ""
}
```

Migration is lazy and in-memory: if `blocks` is absent but `contentMarkdown` /
`embedUrl` are present, synthesize an equivalent block list on read. Nothing is
rewritten in the database until the admin saves.

### The block tree

Blocks are a discriminated union on `type`. Container blocks hold child block
arrays, so the structure is recursive and the renderer is a single recursive
function.

Proposed v1 block set:

**Content**
- `richText` — markdown (reuses `marked` + the existing `PROSE` class)
- `heading` — level, text, optional eyebrow/kicker
- `callout` — variant: note / warning / critical / success / evidence
- `quote` — text, attribution
- `table` — markdown table passthrough
- `divider`

**Media & resources**
- `image` — uploaded or URL, caption, width preset
- `video` — YouTube / Vimeo / Bunny (reuses `src/lib/video.ts`)
- `pdf` — uploaded file, inline viewer + download button
- `embed` — arbitrary iframe (flipbook, Slides, Canva); reuses the existing
  `src/lib/embed.ts` normalizer, which already rewrites Google Slides and
  Office links and strips squat provider heights
- `fileList` — download cards for attachments
- `email` — a rendered email artifact (from / to / cc / date / subject / body /
  attachments). Domain-specific and genuinely useful for investigative
  training material.

**Layout**
- `columns` — 2 or 3 columns, each an independent block array
- `accordion` — items of `{ title, blocks }`
- `tabs` — items of `{ label, blocks }`
- `card` — a bordered container wrapping blocks

**Interactive**
- `checklist` — client-side ticks persisted to localStorage
- `knowledgeCheck` — inline self-check question with a reveal; not graded and
  not recorded (graded assessment stays the `QUIZ` unit type)
- `revealCard` — click-to-flip fact card

**Escape hatch**
- `html` — raw HTML, sanitized on render. Admin-authored only.

### Why this satisfies "don't lock me out"

- The document is plain JSON with a published TypeScript type. The agent can
  write a complete notes page in one action via the JSON source view.
- A parser normalizes and drops unknown/invalid blocks rather than throwing, so
  a hand-authored document can never white-screen a learner.
- The `html` block means anything not covered by a first-class block type is
  still expressible today rather than blocked on a new release.

## Implementation Plan

*(To be expanded once the open questions below are settled.)*

1. `src/lib/blocks.ts` — types, `parseBlocks()` (tolerant), `emptyBlock(type)`,
   legacy `contentMarkdown`/`embedUrl` upgrade.
2. `src/components/blocks/` — one renderer per block type + a recursive
   `<BlockList>`. Server components except the genuinely interactive ones.
3. Wire the renderer into `unit-view.tsx`'s `NOTES` branch.
4. Block editor UI on `src/app/admin/courses/[id]/units/[unitId]/page.tsx`.
5. Server actions in `src/app/admin/courses/actions.ts` for block CRUD and
   asset upload (mirroring `uploadCourseCover`).
6. JSON source view + validate-on-paste.

## Verification

- Round-trip a hand-authored JSON document through the source view and confirm
  it renders.
- Confirm legacy NOTES units (existing `contentMarkdown`) still render before
  and after a save.
- Headless pass over a notes unit as admin and as learner: HTTP 200, no console
  errors, accordions/tabs toggle, PDF and embed frames load.
- Confirm a malformed block array degrades gracefully instead of erroring.

## Open questions

See `ask_question` round 1.
