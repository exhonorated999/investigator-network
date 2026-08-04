"use client";

import { useState } from "react";

/** Copies a comma-separated list of emails to the clipboard for pasting into a mail tool. */
export function CopyEmails({ emails }: { emails: string[] }) {
  const [copied, setCopied] = useState(false);
  if (emails.length === 0) return null;

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(emails.join(", "));
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard blocked — no-op */
        }
      }}
    >
      {copied ? "Copied ✓" : `Copy ${emails.length} email${emails.length === 1 ? "" : "s"}`}
    </button>
  );
}
