"use client";

import { useState, useTransition } from "react";
import { setViperStatus, setViperTracking, type ViperField } from "./actions";

export interface ViperTrackerRow {
  enrollmentId: string;
  name: string;
  email: string;
  agency: string;
  requested: boolean;
  shipped: boolean;
  tracking: string;
}

function Row({ row }: { row: ViperTrackerRow }) {
  const [requested, setRequested] = useState(row.requested);
  const [shipped, setShipped] = useState(row.shipped);
  const [tracking, setTracking] = useState(row.tracking);
  const [savedTracking, setSavedTracking] = useState(row.tracking);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  const toggle = (field: ViperField, checked: boolean) => {
    const prev = { requested, shipped };
    if (field === "requested") setRequested(checked);
    else {
      setShipped(checked);
      if (checked) setRequested(true); // shipping implies requested
    }
    setError("");
    start(async () => {
      try {
        await setViperStatus(row.enrollmentId, field, checked);
      } catch {
        setRequested(prev.requested);
        setShipped(prev.shipped);
        setError("Save failed");
      }
    });
  };

  const saveTracking = () => {
    if (tracking.trim() === savedTracking.trim()) return;
    setError("");
    start(async () => {
      try {
        await setViperTracking(row.enrollmentId, tracking);
        setSavedTracking(tracking.trim());
      } catch {
        setError("Save failed");
      }
    });
  };

  const dirty = tracking.trim() !== savedTracking.trim();

  return (
    <tr className="border-t border-border align-top">
      <td className="px-4 py-3">
        <span className="text-foreground">{row.name}</span>
        {row.agency ? (
          <span className="ml-2 font-mono text-[11px] text-muted">{row.agency}</span>
        ) : null}
        <span className="block font-mono text-[11px] text-muted">{row.email}</span>
      </td>
      <td className="px-4 py-3 text-center">
        <input
          type="checkbox"
          checked={requested}
          onChange={(e) => toggle("requested", e.target.checked)}
          aria-label={`VIPER drive requested for ${row.name}`}
          className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
        />
      </td>
      <td className="px-4 py-3 text-center">
        <input
          type="checkbox"
          checked={shipped}
          onChange={(e) => toggle("shipped", e.target.checked)}
          aria-label={`VIPER drive shipped for ${row.name}`}
          className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
        />
      </td>
      <td className="px-4 py-3">
        {shipped ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              onBlur={saveTracking}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveTracking();
                }
              }}
              placeholder="Paste tracking #"
              aria-label={`Tracking number for ${row.name}`}
              className="field !py-1 !text-[13px] font-mono min-w-[180px]"
            />
            {dirty ? (
              <button type="button" onClick={saveTracking} className="btn btn-ghost btn-sm">
                Save
              </button>
            ) : savedTracking ? (
              <span className="font-mono text-[10px] uppercase tracking-wider text-accent-bright">
                ✓ Saved
              </span>
            ) : null}
          </div>
        ) : (
          <span className="font-mono text-[11px] text-muted">—</span>
        )}
        {error ? (
          <span className="mt-1 block font-mono text-[10px] text-red-400">{error}</span>
        ) : pending ? (
          <span className="mt-1 block font-mono text-[10px] text-muted">Saving…</span>
        ) : null}
      </td>
    </tr>
  );
}

/** Per-student VIPER hard-drive request / shipment tracker. */
export function ViperTracker({ rows }: { rows: ViperTrackerRow[] }) {
  return (
    <div className="panel rule-top mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left">
          <tr>
            <th className="eyebrow eyebrow-muted px-4 py-3">Student</th>
            <th className="eyebrow eyebrow-muted px-4 py-3 text-center">Requested</th>
            <th className="eyebrow eyebrow-muted px-4 py-3 text-center">Shipped</th>
            <th className="eyebrow eyebrow-muted px-4 py-3">Tracking #</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center text-muted">
                No students enrolled yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => <Row key={r.enrollmentId} row={r} />)
          )}
        </tbody>
      </table>
    </div>
  );
}
