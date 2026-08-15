# Partners — tasteful sponsorship & directory

## Context
Justin wants a revenue stream from acknowledging partners/vendors and selling marketing
placements, **without** the "ad creep" of sites like Officer.com (stacked banners, content-
covering popups, irrelevant blinking ads). The audience is a vetted, mission-driven LE
community, so trust is the scarce resource. The winning move is to make partners feel
**native, relevant, bounded, and arguably-wanted** — closer to a curated "who we trust"
product guide than to advertising.

Decisions locked with the user:
- Build **both** surfaces together: a **Partner Spotlight dashboard widget** + a **Partners
  directory page**.
- Framing/label: **"Partners"** (relationship tone), never "Ads/Sponsors".
- Management: **full Admin CRUD** — Justin adds/edits partners (logo, links, blurb, tier)
  himself in the admin panel.

## Anti-ad-creep guardrails (design contract)
These are requirements, not nice-to-haves:
- **Always labeled** "Partner" (small eyebrow), never disguised as editorial.
- **Never** a popup, interstitial, or anything that covers content.
- **One** sponsored item visible per surface at a time (spotlight rotates; directory is a
  browsable page the user chooses to visit).
- Styled with the **existing widget design system** (WidgetCard shell, tokens) so it reads as
  part of the product, not an injected ad slot.
- Spotlight widget lives in a **normal dashboard slot** the user can move or hide — opt-out
  builds trust and paradoxically protects the placement's value.
- **Relevance-vetted** (admin-curated only) and **tier-ordered**, so Featured partners surface
  first but the list stays useful.

## Scope & Non-Goals
**In scope (first version):**
1. `Partner` data model + `PartnerTier` enum + migration.
2. Admin CRUD at `/admin/partners` (create/edit/delete; logo upload; tier; links; blurb;
   active toggle; sort).
3. **Partner Spotlight** dashboard widget (`partners`) — auto-rotating single-partner card,
   wired into the slot system.
4. **Partners directory** page (`/partners`) — "Trusted Partners" grid grouped/ordered by tier.
5. Nav entries: admin nav link + a user-facing link to the directory.
6. Logo storage via the existing persistent upload pipeline (FileUpload + `/api/files/[id]`),
   with `partner-logo` made a public asset.

**Non-Goals (deferred):**
- Self-serve partner portal (partners managing their own listings).
- Per-course "Presented by" credit (easy follow-up once the model exists).
- Impression/click analytics & billing automation (can add a simple click counter later).
- Paid checkout — sponsorship is sold off-platform for now.

## Data model
Mirror the `Resource` model (prisma/schema.prisma:738) — it's the closest precedent
(audience-gated, sort-ordered, admin-managed).

```prisma
enum PartnerTier {
  FEATURED   // spotlight rotation + top of directory
  STANDARD   // directory listing
}

model Partner {
  id           String      @id @default(cuid())
  name         String
  blurb        String      @default("")   // one-line value prop
  url          String                        // partner site / offer link
  tier         PartnerTier @default(STANDARD)
  active       Boolean     @default(true)  // hide without deleting
  logoFileId   String?                       // FileUpload.id (served via /api/files/[id])
  audience     Audience?                     // null = both sides
  sortOrder    Int         @default(0)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@index([tier])
}
```
Migration: `npx prisma migrate dev --name add_partner --skip-seed` (additive only). Then
`npx prisma generate` — NOTE the dev server locks the client DLL on Windows; stop
`start.bat` first, generate, restart (known EPERM workaround).

## Implementation plan

### 1. Schema + migration
- Edit `prisma/schema.prisma`: add `PartnerTier` enum + `Partner` model (above).
- Run additive migration; regenerate client (DLL-lock workaround).

### 2. Data loaders — `src/lib/partners.ts` (new, mirror `src/lib/resources.ts`)
- `loadPartnersForViewer(viewer)` — `active: true`, audience-gated (admins see all), ordered
  by `tier` (FEATURED first) then `sortOrder` then `name`. Include a resolved `logoUrl`
  (`logoFileId ? /api/files/${logoFileId} : null`).
- `loadSpotlightPartners(viewer)` — active FEATURED (fallback to all active if none featured),
  for the rotating widget.
- `loadAllPartners()` — admin list (all, any status).
- `PARTNER_TIERS` label map for the UI.

### 3. Logo storage
- Reuse `saveFile(file, "partner-logo")` (src/lib/storage.ts) + create a `FileUpload` row in
  the admin action (same pattern as course covers).
- `src/app/api/files/[id]/route.ts:29` — add `|| file.purpose === "partner-logo"` to
  `isPublicAsset` so any signed-in user can render the logo (directory + dashboard are behind
  auth, so this is sufficient).

### 4. Admin CRUD — `src/app/admin/partners/` (new, mirror `admin/resources/`)
- `actions.ts`: `createPartner`, `updatePartner`, `deletePartner`, `togglePartnerActive`
  (server actions, `requireAdmin()`, `revalidatePath("/admin/partners")` +
  `revalidatePath("/dashboard")` + `revalidatePath("/partners")`). Normalize URL like
  `normalizeUrl` in resources actions. Handle optional logo upload (skip if no file).
- `page.tsx`: management table + create/edit form (name, blurb, url, tier select, audience
  select, active checkbox, sortOrder, logo file input). Copy the layout/markup idiom from
  `admin/resources/page.tsx` and `admin/conferences/page.tsx`.
- `src/components/admin-nav.tsx:15` — add `{ href: "/admin/partners", label: "Partners" }`
  (after Resources).

### 5. Dashboard Spotlight widget
- `src/components/widgets/partners-card.tsx` (new, client component). Uses `WidgetCard`
  shell (eyebrow **"Partner"**, title **"Partners"**). Renders ONE partner at a time: logo,
  name, one-line blurb, single "Visit ↗" link + host. Auto-rotates every ~8s with a subtle
  fade and manual dots; pauses on hover; respects `prefers-reduced-motion`. `WidgetEmpty`
  when no partners.
- `src/lib/dashboard.ts`: register the widget end-to-end —
  - add `"partners"` to `WidgetId`;
  - add a `WIDGETS` entry (`label: "Partners"`, `description`, `span: 2`);
  - add to `SLOT_CHOICES` (`label: "Partners"`);
  - add a slot to `SLOTS` (append `{ span: 2 }`) and a matching default in `DEFAULT_LAYOUT`
    (place `partners` in a sensible default position, e.g. after `resources`).
- `src/app/dashboard/page.tsx`:
  - import `loadSpotlightPartners` + `PartnersCard`;
  - add `const spotlightPartners = await loadSpotlightPartners(viewer);` to the parallel load;
  - add `case "partners": return <PartnersCard number="11" items={spotlightPartners} />;`
    in `renderWidget` (switch at line 170).

### 6. Partners directory page — `src/app/partners/page.tsx` (new)
- Server component behind auth (`requireViewer`). Loads `loadPartnersForViewer(viewer)`.
- "Trusted Partners" hero + short mission-aligned blurb ("Vendors and organizations we
  partner with to support the field"). Grid of partner cards grouped by tier (Featured band
  first, then Standard), each: logo, name, blurb, visit link. Reuse existing tokens
  (`panel`, `eyebrow eyebrow-gold`, `tag-chip`, `btn`), mirroring the course landing layout.
- Add a nav link to it in the user-facing header `src/components/site-header.tsx` (and/or a
  "See all partners →" footer link inside the Spotlight widget).

## Verification
- `npx tsc --noEmit` → EXIT 0; `npx next build` compiles.
- Migration applies cleanly; `Partner` table exists.
- Admin: create 2–3 partners (1 FEATURED with a logo upload, 1 STANDARD), edit one, toggle
  active off/on, delete one. Confirm logo renders via `/api/files/[id]`.
- Dashboard: add the "Partners" widget to a slot → Spotlight shows a FEATURED partner and
  rotates; hover pauses; empty state shows when none active.
- `/partners`: featured band first, standard below, audience gating correct (test as LE vs
  civilian via `/admin/preview`), links open in new tab with `rel="noopener"`.
- Guardrail check: no popup/interstitial anywhere; every placement carries the "Partner"
  label; widget is movable/hideable in the layout editor.
- Deploy: DB rows are live immediately; code (widget, pages, route change, schema) ships via
  git push to Railway. Keep partners inactive/empty until Justin curates the first cohort.

## Follow-ups (after v1 ships)
- Per-course "Presented by <partner>" credit (add `sponsorPartnerId` to Course).
- Simple click counter on partner links for a basic "value delivered" report to sell renewals.
- News feed "Partner note" slot (clearly labeled) and event/conference sponsor tie-in.
