<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Email campaigns (added 2026-08-16)

Bulk quarterly email system. Key files: `src/lib/campaigns.ts` (recipient assembly + Resend batch send + stats), `src/lib/email-template.ts` (branded HTML shell + `htmlToText`, `PHYSICAL_ADDRESS`, `appUrl`), `src/app/api/webhooks/resend/route.ts` (Svix-signed event tracking), `src/app/api/unsubscribe/route.ts`, admin under `src/app/admin/campaigns` + `src/app/admin/contacts`.

Data model: `Contact` (non-members), `Campaign`, `CampaignRecipient` (per-address delivery/engagement + `unsubToken`), `Suppression` (global do-not-email; honored on campaigns, NOT on transactional mail). Members live in `User`; contacts are deduped against members at send time (members win).

Delivery via Resend batch API (`/emails/batch`, chunks of 100). Transactional mail still uses `src/lib/email.ts`.

REQUIRED PROD SETUP (Railway env + Resend dashboard) for tracking to work:
- Resend: enable Open + Click tracking on the sending domain.
- Resend: add webhook -> https://www.inv-network.org/api/webhooks/resend, subscribe email.delivered/bounced/complained/opened/clicked; copy signing secret.
- Railway env: `RESEND_WEBHOOK_SECRET=whsec_...` (dev skips signature check when unset). Optional `EMAIL_PHYSICAL_ADDRESS` (defaults "14775 Bugle Ct., Fontana, CA 92336"). `AUTH_URL`/`APP_URL` must be the prod URL (used for logo + unsubscribe links).

Compliance: CAN-SPAM footer (unsubscribe + physical address) is baked into the template. Cold-emailing the non-member list risks domain reputation / Resend ToS — warm up, send members first.

Send is guarded: admin must type "SEND" to confirm; only DRAFT campaigns send/edit.

## Personalization / custom lists / full HTML (2026-10-10)
Pure helpers in prisma-free `src/lib/campaign-merge.ts` (tested in `campaign-merge.test.ts`): `{{first_name}}` (fallback "there", or `{{first_name|X}}`) merged per recipient in subject/preheader/body via `renderForRecipient()` in campaigns.ts (used by send, test send, preview route). `Campaign.fullHtml` = send pasted complete HTML doc as-is (auto-on when body has `<html>`/`<body>`), filling `[UNSUBSCRIBE LINK]`/`[MAILING ADDRESS]` (or `{{unsubscribe_url}}`/`{{mailing_address}}`); footer auto-injected if no unsub placeholder. `Campaign.customList` Json = one-off uploaded list (.xlsx via `read-excel-file/node`, or .csv; headers email + first_name/name) — when non-empty it REPLACES members/contacts/course targeting, not saved to Contacts; suppression still honored. `CampaignRecipient.firstName` stored at send. Upload/clear actions in `src/app/admin/campaigns/actions.ts`, result shown via `?list=` flash on the draft page. User chose one-off upload (not tag-based contacts).
Merge engine (2026-10-13) also accepts Liquid-style `{{first_name | default: "X"}}`, `{{agency}}`/`{{department}}` (from list "Agency" column, cleaned "X PD"->"X Police Department"; looked up from customList by email at send, not stored on CampaignRecipient), and aliases `{{unsubscribe_link}}`/`{{postal_address}}`. `greetingNameFrom(name,title)` handles "Det. Frias"->"Detective Frias", "D. Robertson"+title->"Detective Robertson", "Last, First", role inboxes -> blank. From display names with commas are quoted. Campaigns are often created directly in DB via scratch tsx script (DRAFT so user can test-send in prod admin).

# Git: other contributors push to master

The remote (exhonorated999/investigator-network, master, auto-deploys to Railway) receives commits from other sources (e.g. PR #1 signup/rate-limit work). Always `git fetch` and check `HEAD..origin/master` before pushing; if rejected, `git rebase origin/master`, `npm install` (new deps), rebuild, then push. Never force-push. Revert incidental `package-lock.json` churn from local `npm install`.

Windows cmd terminal output is ANSI-garbled: redirect command output to a temp .log file, read it with the file viewer, then delete it.

# DB migrations (Neon, shared)

Datasource env vars: `DB13AFA07B_DATABASE_URL` / `DB13AFA07B_DIRECT_URL`. The Neon DB is effectively shared, so NEVER run `prisma migrate dev` directly (reset risk). Safe workflow: `prisma migrate status` (confirm in sync) -> `prisma migrate dev --name X --create-only` -> review the generated SQL is additive -> `prisma migrate deploy` -> `prisma generate`. Prisma client is generated to `src/generated/prisma` (imported as `@/generated/prisma`).

# Client bundles must stay Prisma-free

Never import a module that imports `@/lib/prisma` into a `"use client"` component (type-only `import type` is fine). Put shared constants/labels in a prisma-free module (e.g. `src/lib/grant-categories.ts`, re-exported from `src/lib/grants.ts`). `src/app/admin/error.tsx` is the admin segment error boundary (shows digest).

# Quiz answer review (added 2026-09-21)

After any GRADED attempt, learners see a collapsible per-question breakdown (their answer vs correct answer). Component `src/components/attempt-review.tsx` (server), wired into `src/components/quiz-taker.tsx` under both the pass and fail banners. Reveals correct answers even on a failed/retryable attempt (by design). No schema change.

# Password reset / forgot password (added 2026-09-21)

Self-service reset reuses the invite-token machinery: `/forgot-password` + `forgotPasswordAction` in `src/app/(auth)/actions.ts` (generic response, no enumeration; issues `PASSWORD_RESET` `InviteToken`, emails via `sendPasswordResetEmail`). Redeem at `/activate/[token]` (48h TTL, single-use).

# LE Grants (added 2026-09-21)

Model `Grant`; admin `src/app/admin/grants` (paste link -> `fetchGrantPreview` prefill); loaders `src/lib/grants.ts`; widget `src/components/widgets/grants-card.tsx`. Audience gating for widgets: `WidgetMeta.audience` + `SLOT_CHOICES[].audience`; helpers `slotChoicesFor` / `canViewWidget` in `src/lib/dashboard.ts`. Admins are audience-neutral. Reuse for side-specific cards.

# Conferences card (2026-10-02)

`ConferencesCard` (`src/components/widgets/conferences-card.tsx`, client) shows ALL upcoming events (`loadUpcomingConferences(viewer)`), scrolls within WidgetCard's max-h-[560px], sticky keyword search.

# VIPER hard-drive tracking (2026-10-02, digital added 2026-10-10)

Cybertips A to Z (`VIPER_COURSE_SLUG = "cybertips-a-to-z"` in `src/lib/metrics.ts`) gets a roster fulfillment panel on `/admin/metrics`. `Enrollment` fields: `viperRequestedAt`, `viperShippedAt`, `viperTracking`, `viperDigitalAt`. Loader `viperRoster()`; actions `src/app/admin/metrics/actions.ts` (`setViperStatus(requested|shipped|digital)`, `setViperTracking`); client `viper-tracker.tsx` (Digital collapses Shipped+Tracking to "Digital download — no drive", data preserved).

# Admin community replies (2026-10-02)

`/admin/moderation`: `adminReply` server action (PostComment as admin, optional `parentId`), client `reply-box.tsx`.

# Course evaluations (2026-10-10)

Mandatory end-of-course evaluation gating the certificate. Config is code, prisma-free: `src/lib/evaluation-config.ts` (`COURSE_EVALUATIONS` keyed by course slug — currently only `cybertips-a-to-z`; question kinds stars/yesno/text + optional testimonial yes/no+text). To add an eval to another course, add an entry there. Model `CourseEvaluation` (userId+courseId unique, `answers` Json, `testimonialOk`, `testimonial`). Gate: `evaluationSatisfied()` in `src/lib/certificate.ts`, checked inside `maybeIssueCertificate` after `isCourseComplete`. Learner page `/courses/[slug]/evaluation` (form `evaluation-form.tsx` uses controlled inputs + `useActionState`; action `submitEvaluation` validates, saves, issues cert, redirects to certificate). Entry point is ONLY the in-course left sidebar ("Wrap-up → Course Evaluation", lock/Required/✓ states) in `src/app/courses/[slug]/units/[unitId]/page.tsx`, plus the last unit's Next button. User explicitly does NOT want it on the course overview page. Admin results `/admin/evaluations` (averages, distribution, recommend %, testimonials, per-response details).

# Class board (2026-10-10)

Per-course discussion board. Trigger is a small vertical "💬 Board" tab mounted on the outline `<aside>`'s right edge (absolute md:left-full md:top-28, gold ⚑ unread badge) — user does NOT want it as a menu item or floating elsewhere. The aside is `relative z-40` so the fixed drawer paints above course content. Do NOT portal to body (fixed positioning broke there; tab ended up at page bottom). Enabled per slug in prisma-free `src/lib/board-config.ts` (`BOARD_COURSES`, currently only `cybertips-a-to-z`; kinds INTRO/QUESTION/NEWS/RESOURCE; 10MB file limit). Board courses hide the old overview `<CourseForum>` Q&A (other courses keep it). Models `BoardPost` (kind, title, body, linkUrl, agency, contactEmail, fileId→FileUpload purpose "board-file", hidden, lastActivityAt), `BoardReply` (staff, hidden), `BoardRead` (userId+postId readAt = unread tracking). Loaders + unread rules in `src/lib/board.ts` (a new post is unread for everyone enrolled; replies alert only the author + thread participants). Actions `src/app/courses/[slug]/board/actions.ts` (a reply emails the post author via `sendBoardReplyEmail`). UI `src/components/board/*` (panel, composer, post card). INTRO posts render collapsed to a one-line row unless focused (`defaultOpen`); user declined collapsing other kinds for now. Thread page `/courses/[slug]/board/[postId]` is the dashboard notification target (marks read, reply inline). Dashboard: `NotifKind "board"` from `loadBoardAlerts` in `src/lib/notifications.ts`. Files route lets anyone with board access read board-file (forces download except pdf/images, nosniff). Admin: `/admin/moderation?view=boards` (`board-moderation.tsx`: hide/delete/instructor reply). Player accepts `?board=1` or `?board=<postId>` to auto-open.