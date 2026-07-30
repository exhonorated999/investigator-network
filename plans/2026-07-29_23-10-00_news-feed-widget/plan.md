# Phase 8 — Curated News Feed (widget 1 of the remaining dashboard cards)

## Context
The dashboard widget framework shipped in Phase 7 (`src/lib/dashboard.ts`,
`src/app/dashboard/page.tsx`, `CustomizePanel`). Three widgets are stubs:
`announcements` (news feed), `messages`, `network`. This plan replaces the
`announcements` stub with a real **curated news feed**:

- Admins paste articles into the feed and tag each with a topic category
  (ICAC, Sex Offender, General, Digital Forensics, Narcotics, …).
- Learners choose which categories they want to see; the dashboard card only
  shows articles in their selected topics.

## Findings so far
- `Category { id, name @unique, courses Course[] }` already exists and is the
  taxonomy behind courses — reusable as the shared topic list for news.
- Widget registry is pure/client-safe (`src/lib/dashboard.ts`); the Prisma
  loader is isolated in `src/lib/dashboard-prefs.ts`. Widget ids that no longer
  exist are silently dropped, so renaming `announcements` → `news` is safe.
- Learner prefs live in `DashboardPref { userId @unique, widgets Json }` —
  category subscriptions can join it as a second Json column or a join table.
- Admin CRUD pattern: `src/app/admin/**/page.tsx` (server component) +
  sibling `actions.ts` server actions + `revalidatePath`. Nav links are
  hardcoded in `src/components/admin-nav.tsx`.

## Open questions
(see ask_question round 1)

## Scope & Non-Goals
TBD after questions.

## Implementation Plan
TBD.

## Verification
Throwaway `scripts/verify_news.mjs` (cookie-jar login pattern) asserting:
admin can create an article, learner sees it, learner unsubscribing from a
category hides it, `/news` index paginates.
