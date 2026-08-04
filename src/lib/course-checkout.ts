/**
 * Purchase details for PAID courses.
 *
 * The platform has no checkout of its own — payment happens off-site (Stripe
 * payment links) and an admin then enrolls the attendee manually. Rather than
 * add columns to Course for a handful of paid offerings, the payment link and
 * invoice contact live here, keyed by course slug.
 *
 * A PAID course with no entry still renders correctly: the overview page falls
 * back to "contact us to enroll" using DEFAULT_INVOICE_EMAIL.
 */

export interface CourseCheckout {
  /** Hosted payment page (Stripe payment link, etc.). */
  checkoutUrl: string;
  /** Where "request an invoice" mail goes. */
  invoiceEmail: string;
  /** Displayed price, e.g. "$795 per attendee". Free-text so it can say "per seat". */
  priceLabel?: string;
  /** One-line note under the buttons — seat limits, what's included, etc. */
  note?: string;
}

export const DEFAULT_INVOICE_EMAIL = "justin@intellect-le.com";

const CHECKOUTS: Record<string, CourseCheckout> = {
  "cybertips-a-to-z": {
    checkoutUrl: "https://buy.stripe.com/3cI8wOb886Tufsi2IY33W0a",
    invoiceEmail: "justin@intellect-le.com",
    note:
      "Includes a lifetime Project V.I.P.E.R. license ($600 value), a 500 GB drive " +
      "with V.I.P.E.R. pre-installed and pre-registered, and access to the " +
      "Project V.I.P.E.R. course.",
  },
};

export function courseCheckout(slug: string): CourseCheckout | null {
  return CHECKOUTS[slug] ?? null;
}

/** Prefilled invoice-request mailto for a course. */
export function invoiceMailto(courseTitle: string, email: string): string {
  const subject = `Invoice request — ${courseTitle}`;
  const body =
    `Please send an invoice for ${courseTitle}.\n\n` +
    `Agency:\nAttendee name(s):\nAgency email:\nPhone:\nBilling contact:\nPurchase order # (if any):\n`;
  return (
    `mailto:${email}?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`
  );
}
