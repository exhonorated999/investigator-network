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