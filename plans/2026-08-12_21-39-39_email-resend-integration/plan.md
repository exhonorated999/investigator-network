# Email Integration via Resend

## Context
The user wants real transactional email on the live Investigator Network LMS (Next.js 16 + Prisma + Neon, Railway at www.inv-network.org). Three use cases:
1. **Automatic Teams meeting reminders** — tell enrolled learners to log in ~15 min before a live session start time.
2. **Enrollment notification emails** — notify a learner when they're enrolled in a course.
3. **Password reset emails** — DEFERRED by user ("do that later"). Not in scope now.

Chosen provider: **Resend** (https://resend.com/emails).

## Current State (already in the codebase — reuse, don't rebuild)
- `src/lib/email.ts` — provider-agnostic helper. `send()` is a **stub** that logs to console unless SMTP_* env vars are set (they aren't). Exposes:
  - `sendApprovalEmail(to, name)` — wired into `admin/users/actions.ts` (approve flow).
  - `sendDenialEmail(to, name)` — wired into deny flow.
  - `sendLiveSessionReminder(to, name, {courseTitle, unitTitle, startsAt, joinUrl})` — wired into a **manual** admin action.
- `src/app/admin/courses/actions.ts::sendLiveSessionReminders(formData)` — manual "email all enrolled learners" button on the live-unit admin page (`admin/courses/[id]/units/[unitId]/page.tsx`).
- `src/lib/reminders.ts::loadLiveTrainingReminders()` — computes per-course last/next session date + enrollees since last session.
- Live sessions = `Unit` rows with `type = "LIVE_SESSION"`, JSON `data = { teamsJoinUrl, startsAt, durationMin, replayUrl? }`.
- Enrollment creation points: `admin/users/actions.ts` lines ~89 and ~369 (`prisma.enrollment.createMany`).
- Env: DB via `DB13AFA07B_DATABASE_URL`; login URL via `AUTH_URL`. Prisma client at `src/generated/prisma`.

## Scope & Non-Goals
**In scope (v1):**
- Wire Resend into `email.ts::send()` (replace the SMTP stub), keep dev/no-key fallback to console.
- Add automatic live-session reminder emails ~15 min before `startsAt`, sent once per (unit, user).
- Add enrollment notification emails when a learner is enrolled.
- A cron/scheduler mechanism on Railway to drive the reminder check.

**Non-goals (deferred):**
- Password reset emails (explicit user defer).
- HTML/branded email templates beyond simple text (can follow later).
- Digest/marketing emails.

## Open Decisions (see questions)
1. Resend verified sending domain + From address.
2. Scheduling mechanism on Railway (cron service hitting a secured API route vs. Railway native cron running a script).
3. Enrollment email trigger scope (every enroll, incl. bulk admin enroll of thousands, or only self/individual enroll?).

## Implementation Plan (draft — finalize after questions)

### 1. Resend delivery in `src/lib/email.ts`
- `uv`/npm add `resend` (or call REST API via `fetch` to avoid a dep).
- Read `RESEND_API_KEY` (new secret) + `EMAIL_FROM` (verified domain address).
- In `send()`: if `RESEND_API_KEY` set → send via Resend; else keep console fallback.
- Keep the `Mail { to, subject, text }` interface; optionally add `html`.

### 2. Idempotency for reminders (avoid double-sends)
- Add a small `EmailLog` model (or `SentReminder`) keyed by `(unitId, userId, kind)` unique, so the cron can send-once. Migration required.
- Alternatively store a `remindersSentAt` marker on the unit's JSON `data` (coarser). Prefer the log table.

### 3. Automatic reminder job
- New secured endpoint `src/app/api/cron/live-reminders/route.ts` (POST, guarded by `CRON_SECRET` header/bearer).
- Logic: find `LIVE_SESSION` units whose `startsAt` is within the next ~15 min window and not yet reminded; for each, load APPROVED enrollees; send `sendLiveSessionReminder`; record in `EmailLog`.
- Reuse `reminders.ts` patterns; parse `startsAt` from `data`.
- Railway cron triggers this every 5 min.

### 4. Enrollment notifications
- New `sendEnrollmentEmail(to, name, { courseTitle, courseUrl })` in `email.ts`.
- Call it at the enrollment creation points (respecting the trigger-scope decision).

## Verification
- Local: run with no `RESEND_API_KEY` → confirm console fallback still logs (no crash).
- With key set (test): send a live-session reminder to a test address via the existing manual admin button → confirm receipt in Resend dashboard.
- Cron endpoint: `curl -X POST` with the `CRON_SECRET` against a seeded near-future live unit → confirm one email per enrollee, second call sends nothing (idempotent).
- Enrollment: enroll a test user → confirm one email.
- Build (`npm run build`) + `npx tsc --noEmit` clean before deploy. Watch the client/server boundary (email.ts is server-only — never import into a `"use client"` component).
