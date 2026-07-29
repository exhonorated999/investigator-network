"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:border-accent/60 print:hidden"
    >
      Print / Save as PDF
    </button>
  );
}
