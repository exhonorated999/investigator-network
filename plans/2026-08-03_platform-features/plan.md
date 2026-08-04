# Investigator Network — Multi-Feature Build Plan

## Context
The platform is live for active law-enforcement (LE) learners. The owner wants to (a) open a parallel **Civilian Investigator** side that is walled off from the LE side, and (b) ship a batch of platform improvements across social, courses, admin, metrics, comms and certificates. This plan captures all 11 requested items, notes what already exists to reuse, and sequences the work into phases. Content lives in Postgres (Neon) via Prisma; Next.js 16 App Router with server actions.

## Scope & Non-Goals
- In scope: all 11 items below, delivered in phases. Phase 1 = the audience split (#2) because it is the foundation most other items depend on.
- Non-goals (deferred unless requested): mobile app, granular per-agency permissions beyond LE/Civilian, real-time websockets, payment processing/checkout (the Free/Paid toggle in #7 is a classification only, not e-commerce).

## Open Decisions (confirm before build)
- Audience model, .gov auto-approval, civilian theming — see questions.
- Mail Relay integration vs. "new enrollees" export — see questions.
- Build order / what ships first.

---

## Feature Breakdown

### #2 — Civilian vs Law-Enforcement split (FOUNDATION)
Existing: `User.role` (LEARNER/ADMIN), `User.status` (PENDING/APPROVED/DENIED/SUSPENDED), register flow in `src/app/(auth)/actions.ts`, admin approve/deny/suspend in `src/app/admin/users/actions.ts`.
Plan:
- Schema: add `enum Audience { LE CIVILIAN }` and `User.audience`. Add `Course.audiences` (supports LE, CIVILIAN, or both) + `Course.private Boolean`. Add `audience` scoping to community topics, news categories, and DM search.
- Register form (`register/`): collect name, email, agency/business, state, and LE vs Civilian radio. New fields need Prisma cols (`state`, agency already exists) + `registerSchema` update in `src/lib/validation.ts`.
- Auto-approval logic in `registerAction`: civilian → auto-APPROVED; LE with `.gov` email → auto-APPROVED; LE without `.gov` → PENDING (manual).
- Admin manual enrollment: add a "create user" admin action with a Civilian/LE checkbox that sets audience + APPROVED, overriding approval gate.
- Visibility rules (server-side filters): civilian users only see civilian courses, civilian community, civilian news, and civilian users in DM search — and vice-versa for LE. Admins see all.
- Aesthetic: civilian gets a distinct accent/theme + a differentiated after-login dashboard hero so the owner can tell sides apart at a glance.
- New civilian-only surfaces: **Private Investigator News feed** and **Private Investigator Community Forum** (new community topics gated to civilians; e.g. CDFIR, Private Investigations).

### #1 — Social posts support link pasting (YouTube, Instagram, LinkedIn, etc.)
Existing: `src/lib/embed.ts` (parseEmbedInput), `src/lib/video.ts` (youtube/bunny), `src/lib/link-preview.ts` (OG scraper), community composer in `src/app/community/`.
Plan: detect URLs in post body / add a "link" field; render an embed (video) or OG link-preview card. Store `linkUrl`/preview fields on `Post`. Reuse existing libs.

### #3 — Suspend & remove accounts
Existing: suspend/reactivate already implemented.
Plan: add `deleteUser` admin action (hard delete via cascade, or soft-delete flag) with confirmation. Decide soft vs hard.

### #4 — Course metrics (searchable by period)
Existing: `src/lib/analytics.ts` (periodStart, course engagement), presence fields on User (`lastSeenAt`, `lastSeenCourseId`).
Plan: per-course dashboard — total time on course, top users, last-logged-in users, enrollment/completion — filterable by week/month/quarter/year. Time-on-course needs a data source: derive from presence heartbeats or add lightweight session/time tracking. New `src/app/admin/courses/[id]/metrics` page.

### #5 — Per-course discussion forums (with admin answering)
Existing: community `Post`/`PostComment` models, moderation actions.
Plan: add `courseId` scoping for course-specific threads (either reuse Post with a course topic, or a dedicated `CourseQuestion`/`CourseThread` model). Surface unanswered questions in the admin dashboard with inline reply.

### #6 — Admin dashboard cleanup
Existing: `src/app/admin/` (analytics, courses, grading, moderation, news, users).
Plan: restructure `admin/page.tsx` into a cleaner visual overview (KPIs, quick actions, pending queue, recent questions). Design pass.

### #7 — Course library toggle: Enrolled / Free / Paid
Existing: dashboard `CourseAlbum`, `Enrollment`, favorites. No price field.
Plan: add `Course.pricing` (FREE/PAID) + optional price display. Add a filter toggle (Enrolled / Free / Paid) to the library view.

### #8 — Conferences & Trainings feed
Existing: `NewsArticle` model + news feed patterns, resources card.
Plan: new `Conference` model (name, startsAt, endsAt, location, about, url) + admin CRUD + a dashboard feed card mirroring Tools/Resources.

### #9 — Pin "01 My Training" + "02 Dispatch Notifications" at top
Existing: `src/lib/dashboard.ts` SLOTS/DEFAULT_LAYOUT; `courses`+`notifications` marked `permanent`.
Plan: render the two pinned cards in a fixed top region (non-customizable), and remove them from the customizable slot canvas so remaining cards stay user-configurable.

### #10 — Live-training reminders (Mail Relay integration OR enrollee export)
Existing: `src/lib/email.ts` stub with `sendLiveSessionReminder`; `LIVE_SESSION` unit type carries `startsAt`.
Plan (pending decision): either (a) wire Mail Relay API/SMTP for real sends, or (b) admin view listing **new enrollees since the last live-training date** per course for manual sending. Likely build (b) regardless as a reliable fallback.

### #11 — Branded completion certificates
Existing: `Certificate` model + `src/app/certificates/[serial]/page.tsx` (logo, name, course, serial, issued date, print).
Plan: add instructor name, training-hours, and date-of-completion. Training hours needs a `Course.trainingHours` field (or sum of unit durations). Instructor name = configurable (course field or global setting).

---

## Suggested Phase Order
1. **Phase 1 — Audience foundation (#2):** schema, register, auto-approval, admin manual enroll, visibility filters, civilian theme + civilian news/forum surfaces. (Largest; unblocks the rest.)
2. **Phase 2 — Admin & accounts (#3, #6):** delete accounts + admin dashboard cleanup.
3. **Phase 3 — Courses (#7, #9, #5):** library toggles, pinned cards, per-course forums.
4. **Phase 4 — Feeds & social (#1, #8):** link embeds in posts, conferences feed.
5. **Phase 5 — Metrics & comms (#4, #10, #11):** course metrics, reminders/export, branded certificates.

## Verification (per phase)
- Prisma migrate + regenerate client to `src/generated/prisma`.
- Playwright (msedge headless) smoke of each new surface as both an LE and a civilian user, plus admin.
- Confirm civilian cannot see LE courses/community/news/users and vice-versa.
- Screenshot each new/changed page.
