# Investigator Network — Custom LMS Plan

## Context
Replace the current LearnWorlds account with a self-owned, branded Learning Management
System for **Investigator Network** — a training platform for law-enforcement / agency
personnel (current LearnWorlds scale: ~5,744 users, 48 courses, 9 categories).

Motivations:
- Dislike of LearnWorlds' cluttered, un-branded, generic admin UI and billing/e-commerce noise.
- Desire to own the platform, control branding (detective / dark-tech aesthetic), and reduce cost.
- Need feature parity on the parts that matter: gated registration, live training, on-demand
  video, tests (multiple-choice + document upload), interactive course notes, and an admin
  back end for approvals, course creation, and grading.

Reference assets captured in `assets/brand/`:
- `logo_investigator_network.png`, `banner_symposium.png` — brand + color palette (dark navy,
  cyan/teal accents, gold outline, purple highlights).
- `course_screenshot_learnworlds.png` — target course-player layout (left path/outline, main
  content pane, progress %, unit types: video, ebook, file assignment, Teams meeting, certificate).
- `admin_dashboard_learnworlds.png` — current admin (what NOT to do: cluttered, generic green).
- `teams_meeting_create_1/2/3.png` — LearnWorlds live-session fields (reference for our unit).

## Decisions (locked for v1)
- **Hosting:** Railway (existing server). Postgres add-on + persistent volume for uploaded files.
- **Stack:** Next.js 14+ (App Router, React + TypeScript), Tailwind CSS, Prisma ORM, Postgres.
  Single full-stack app, one deploy, mobile-first responsive.
- **Auth:** Email/password via Auth.js (NextAuth) Credentials provider. **Approval-gated**:
  new users land in `PENDING` and cannot access training until an admin sets `APPROVED`.
- **Video:** Unlisted **YouTube** embeds (zero storage cost). Access control lives in our app
  around the embed. Design the schema so a self-hosted / Mux provider can be swapped in later.
  - Note/limitation: unlisted YouTube URLs are shareable; true DRM is out of scope for v1.
- **Teams:** **Option 2 (manual link)** — admin pastes a Teams join link + date/time/duration
  into a "Live Session" unit. NO Azure app registration / Graph API in v1. Schema left open to
  add Graph auto-creation later.
- **Payments:** None in v1 (approval-gated free access). Schema/roles designed so paid courses
  can be added later without a rewrite.

## Scope & Non-Goals

### In scope (v1)
1. **Public site + branding** — landing page, login, register, responsive dark theme.
2. **Registration + approval flow** — capture name, agency, email (+ password). PENDING → admin
   approves → APPROVED can log in and access enrolled courses.
3. **Roles** — `LEARNER` and `ADMIN` (extensible enum).
4. **Course structure** — Course → Sections → Units. Unit types:
   - `VIDEO` (YouTube embed), `EBOOK`/`NOTES` (rich interactive notes), `LIVE_SESSION`
     (Teams link + schedule), `FILE_ASSIGNMENT` (learner uploads a document),
     `QUIZ` (multiple-choice + document-upload questions), `CERTIFICATE`.
5. **Course player** — left outline w/ progress %, main content pane, prev/next nav, per-unit
   completion tracking (mirrors the LearnWorlds screenshot layout).
6. **Interactive course notes** — rich-text/markdown notes per unit; optional downloadable PDF.
7. **Assessment engine**
   - Admin builds tests: multiple-choice (auto-graded) + document-upload questions (manual grade).
   - Learner takes test, submits answers + file uploads.
   - Admin moderation/grading queue; pass/fail + score; feeds certificate.
8. **Admin back end (clean, branded, action-first)**
   - Dashboard prioritizing *pending approvals* and *tests awaiting grading* (unlike current clutter).
   - User management (approve/deny/suspend, view agency/email, enroll in courses).
   - Course builder (create/edit courses, sections, units, upload notes, set YouTube IDs,
     add Teams links, build quizzes).
   - Grading queue for file-upload questions + assignments.
   - Basic analytics: signups over time, active learners, course completions.
9. **File uploads** — test/assignment document uploads + admin course files, stored on Railway
   persistent volume (abstracted storage layer so S3/R2 can replace it later).
10. **Responsive** — phones, tablets, desktop.
11. **Email** — transactional emails (approval granted/denied, optional live-session reminders)
    via a provider (Resend or SMTP). Reminder scheduling minimal in v1.

### Non-Goals (deferred)
- Microsoft Graph auto-creation of Teams meetings (Option 1) — later phase.
- Payments / e-commerce / coupons.
- Bulk migration of the 5,744 users and 48 courses (design importable, execute later).
- Native mobile app, discussion forums / social feed, live presence ("online users"),
  advanced marketing tools, SSO/SCIM.
- Recurring-meeting auto-generation, mass reminder campaigns.

## Architecture

### Data model (Prisma, high level)
- **User**: id, name, email (unique), passwordHash, agency, role (`LEARNER`|`ADMIN`),
  status (`PENDING`|`APPROVED`|`DENIED`|`SUSPENDED`), createdAt, approvedAt, approvedById.
- **Course**: id, title, slug, description, categoryId, coverImage, status (`DRAFT`|`PUBLISHED`), createdAt.
- **Category**: id, name.
- **Section**: id, courseId, title, order.
- **Unit**: id, sectionId, title, type (enum above), order, completionRule, body (JSON per type):
  - VIDEO → { youtubeId, durationSec }
  - NOTES/EBOOK → { contentMarkdown, pdfFileId? }
  - LIVE_SESSION → { teamsJoinUrl, startsAt, durationMin, replayUrl? }
  - FILE_ASSIGNMENT → { prompt, allowedFileTypes }
  - QUIZ → linked Quiz
  - CERTIFICATE → { templateId }
- **Enrollment**: id, userId, courseId, enrolledAt.
- **UnitProgress**: id, userId, unitId, status (`INCOMPLETE`|`COMPLETE`), completedAt.
- **Quiz**: id, unitId, title, passScore.
- **Question**: id, quizId, type (`MULTIPLE_CHOICE`|`DOCUMENT_UPLOAD`), prompt, order, points.
- **Choice**: id, questionId, text, isCorrect (MC only).
- **Attempt**: id, quizId, userId, submittedAt, score, status (`PENDING_GRADING`|`GRADED`),
  passed.
- **Answer**: id, attemptId, questionId, selectedChoiceId? , uploadedFileId?, awardedPoints?,
  gradedById?.
- **FileUpload**: id, ownerUserId, path, filename, mimeType, sizeBytes, purpose, createdAt.
- **Certificate**: id, userId, courseId, issuedAt, serial.

### App structure (Next.js App Router)
- `app/(public)/` — landing, /login, /register.
- `app/(learner)/dashboard`, `/courses`, `/courses/[slug]`, `/courses/[slug]/units/[unitId]`.
- `app/(admin)/admin/...` — dashboard, users, courses (builder), grading, analytics.
- `app/api/...` — auth, uploads, quiz submission, grading, admin actions (or server actions).
- `lib/` — auth config, prisma client, storage abstraction, email, rbac guards.
- `components/` — course player, unit renderers, quiz builder/taker, admin tables.
- Middleware — route protection by role + APPROVED status.

## Implementation Plan (phased)

**Phase 0 — Scaffold & infra**
- `create-next-app` (TS, App Router, Tailwind, ESLint). Init git.
- Add Prisma + Postgres; `.env` for `DATABASE_URL` (Railway), `NEXTAUTH_SECRET`, email keys.
- Base dark theme + brand tokens from palette; drop logos into `public/`.
- Storage abstraction (`lib/storage.ts`) writing to Railway volume path.
- `start.sh` using `$APP_PORT`; Railway deploy config.

**Phase 1 — Auth & approval gating**
- Prisma User model + migrations. Auth.js Credentials provider, bcrypt password hashing.
- Register form (name, agency, email, password) → creates PENDING user.
- Login blocks non-APPROVED users with a clear "awaiting approval" message.
- Middleware/RBAC guards. Seed one ADMIN account.

**Phase 2 — Admin: users & approvals**
- Admin shell + clean action-first dashboard (pending approvals + grading counts on top).
- User list w/ approve / deny / suspend, agency/email display, search/filter.
- Approval-granted / denied transactional emails.

**Phase 3 — Courses & course builder**
- Course/Section/Unit models + admin CRUD builder.
- Unit editors: VIDEO (YouTube ID), NOTES (rich text), LIVE_SESSION (Teams URL + schedule),
  FILE_ASSIGNMENT, CERTIFICATE placeholder.
- Publish/draft; categories; cover images.

**Phase 4 — Learner course player**
- Enrollment + course catalog (approved users only).
- Player layout mirroring reference: left outline w/ progress %, main pane, prev/next.
- Unit renderers + per-unit completion tracking; course progress %.

**Phase 5 — Assessment engine**
- Quiz model + builder (MC with correct choices; document-upload questions).
- Learner quiz-taker w/ file upload; attempt submission.
- Auto-grade MC; queue DOCUMENT_UPLOAD for manual grading.
- Admin grading queue: view uploads, award points, pass/fail, feedback.

**Phase 6 — Certificates + analytics + polish**
- Certificate issuance on course/test completion (branded PDF).
- Admin analytics (signups over time via Altair-style/Recharts, active learners, completions).
- Live-session reminder emails (basic). Responsive QA across phone/tablet/desktop.

**Phase 7 — Deploy to Railway**
- Provision Postgres + volume, set env vars, run migrations, seed admin, verify prod.

## Verification
- **Auth/approval:** register → user is PENDING and cannot log in; admin approves → login works;
  deny/suspend blocks access. Unit tests on RBAC guard + status checks.
- **Course builder → player:** create a course with each unit type; confirm it renders in the
  player and progress % updates on completion.
- **Live session:** paste a Teams link + time; learner sees join button and schedule; completion
  rule marks unit complete.
- **Quiz:** build MC + document-upload quiz; learner submits with a file; MC auto-scores;
  admin grades the upload; pass/fail + certificate issue correctly.
- **Uploads:** verify files persist on Railway volume and re-download intact.
- **Responsive:** manual check at mobile / tablet / desktop breakpoints (player + admin tables).
- **Prod smoke test:** end-to-end on Railway (register → approve → take course → grade).

## Open Items / Future Phases
- Microsoft Graph Teams auto-creation (Option 1) — replaces manual link paste.
- Migration scripts for existing 5,744 users + 48 courses from LearnWorlds export.
- Payments / paid courses. Discussion / social features. Live presence.
- Consider Mux or Cloudflare Stream if private, DRM-protected video becomes a requirement.
