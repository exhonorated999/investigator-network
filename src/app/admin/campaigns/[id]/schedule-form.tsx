"use client";

import { useState } from "react";

/**
 * Schedule form for a draft campaign. The native datetime-local input is in the
 * admin's local timezone; we convert it to an ISO-8601 UTC string in a hidden
 * field so the server stores an unambiguous instant. Requires typing SEND, same
 * as an immediate blast.
 */
export function ScheduleForm({
  action,
  campaignId,
  total,
}: {
  action: (formData: FormData) => Promise<void>;
  campaignId: string;
  total: number;
}) {
  const [local, setLocal] = useState("");
  const iso = local ? new Date(local).toISOString() : "";
  const tz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "local time";

  // Default the picker no earlier than ~5 minutes from now.
  const min = (() => {
    const d = new Date(Date.now() + 5 * 60_000);
    const off = d.getTimezoneOffset();
    const localMs = d.getTime() - off * 60_000;
    return new Date(localMs).toISOString().slice(0, 16);
  })();

  return (
    <form action={action} className="mt-4 grid gap-3 sm:max-w-lg">
      <input type="hidden" name="id" value={campaignId} />
      <input type="hidden" name="scheduledAt" value={iso} />
      <label className="grid gap-1.5">
        <span className="eyebrow eyebrow-muted">Send date &amp; time ({tz})</span>
        <input
          type="datetime-local"
          value={local}
          min={min}
          onChange={(e) => setLocal(e.target.value)}
          required
          className="field"
        />
      </label>
      <label className="grid gap-1.5">
        <span className="eyebrow eyebrow-muted">Type SEND to confirm</span>
        <input
          name="confirm"
          required
          className="field w-40"
          placeholder="SEND"
          autoComplete="off"
        />
      </label>
      <div>
        <button type="submit" disabled={!iso} className="btn btn-primary btn-sm disabled:opacity-40">
          Schedule for {total} recipients
        </button>
      </div>
    </form>
  );
}
