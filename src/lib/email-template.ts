/**
 * Branded email shell for bulk campaigns (server-only).
 *
 * Wraps admin-pasted body HTML in the INV-Network aesthetic using table layout
 * + inline styles (the only thing email clients render reliably) and injects
 * the CAN-SPAM-required footer: a working unsubscribe link and a physical
 * mailing address. Never import into a "use client" component.
 */

/** Brand palette mirrored from globals.css (email needs literal hex). */
const C = {
  void: "#0d0f14",
  surface: "#141720",
  surface2: "#1a1d26",
  foreground: "#e0e8f0",
  muted: "#8899aa",
  accent: "#00b4d8",
  cyan: "#90e0ef",
  amber: "#f4a261",
  border: "#1e2b38",
} as const;

/** Physical mailing address for the footer. Override via env for flexibility. */
export const PHYSICAL_ADDRESS =
  process.env.EMAIL_PHYSICAL_ADDRESS || "14775 Bugle Ct., Fontana, CA 92336";

export function appUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.AUTH_URL ||
    "https://www.inv-network.org"
  ).replace(/\/+$/, "");
}

export interface CampaignEmailParts {
  subject: string;
  /** Inbox preview text; hidden in the body. */
  preheader?: string;
  /** Admin-crafted body HTML, inserted into the branded content region. */
  bodyHtml: string;
  /** Absolute unsubscribe URL for this recipient. */
  unsubscribeUrl: string;
}

/**
 * Render the full branded HTML document for a campaign email.
 */
export function renderCampaignEmail(parts: CampaignEmailParts): string {
  const base = appUrl();
  const logo = `${base}/brand/logo.png`;
  const preheader = (parts.preheader || "").trim();

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(parts.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.void};color:${C.foreground};-webkit-text-size-adjust:100%;">
  ${
    preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${escapeHtml(
          preheader
        )}</div>`
      : ""
  }
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.void};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:${C.surface};border:1px solid ${C.border};border-radius:12px;overflow:hidden;">
          <!-- top accent rule -->
          <tr><td style="height:4px;background-color:${C.accent};line-height:4px;font-size:4px;">&nbsp;</td></tr>

          <!-- header -->
          <tr>
            <td style="padding:24px 32px 8px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <img src="${logo}" width="40" height="40" alt="Investigator Network" style="display:block;border:0;border-radius:8px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:bold;letter-spacing:0.5px;color:${C.foreground};text-transform:uppercase;">Investigator Network</div>
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;color:${C.muted};text-transform:uppercase;">Intellect LE</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- divider -->
          <tr><td style="padding:12px 32px 0 32px;"><div style="border-top:1px solid ${C.border};font-size:0;line-height:0;">&nbsp;</div></td></tr>

          <!-- body -->
          <tr>
            <td style="padding:20px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:${C.foreground};">
              ${parts.bodyHtml}
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td style="padding:20px 32px 28px 32px;">
              <div style="border-top:1px solid ${C.border};padding-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${C.muted};">
                <p style="margin:0 0 8px 0;">
                  You're receiving this because you're a member of, or subscribed to updates from, Investigator Network.
                </p>
                <p style="margin:0 0 8px 0;">
                  <a href="${parts.unsubscribeUrl}" style="color:${C.cyan};text-decoration:underline;">Unsubscribe</a>
                  &nbsp;·&nbsp;
                  <a href="${base}" style="color:${C.cyan};text-decoration:underline;">inv-network.org</a>
                </p>
                <p style="margin:0;color:${C.muted};">
                  Investigator Network · ${escapeHtml(PHYSICAL_ADDRESS)}
                </p>
                <p style="margin:8px 0 0 0;color:${C.muted};">
                  &copy; ${new Date().getFullYear()} Investigator Network / Intellect LE. All rights reserved.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Very small HTML→text reducer for the plain-text alternative part. Not a full
 * parser — enough to give text-only clients readable content and to satisfy
 * spam filters that penalize HTML-only mail.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
