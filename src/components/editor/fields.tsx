"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * Controls for the properties rail.
 *
 * The split between these and the inline fields is the whole editing model:
 * anything the learner will READ is edited in place on the canvas; anything
 * that changes how a block BEHAVES or is laid out lives here. Putting a
 * "heading level" dropdown on the canvas would clutter the page you are trying
 * to look at, and putting the heading text in a side panel is exactly the
 * form-filling the visual editor exists to get rid of.
 */

export function PropGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-border pt-3 first:border-t-0 first:pt-0">
      <p className="eyebrow eyebrow-muted">{label}</p>
      <div className="mt-2 grid gap-3">{children}</div>
    </div>
  );
}

export function PropText({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="field w-full text-[13px]"
      />
      {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}

export function PropNumber({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className="field w-full text-[13px]"
      />
      {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}

export function PropSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  hint?: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="field w-full text-[13px]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}

export function PropToggle({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0">
        <span className="block text-[13px] text-foreground">{label}</span>
        {hint ? <span className="block text-[11px] text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

/** Small inline control strip for repeated sub-items (choices, options, steps). */
export function ItemControls({
  onRemove,
  removeLabel,
  disabled,
  children,
}: {
  onRemove: () => void;
  removeLabel: string;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {children}
      <button
        type="button"
        aria-label={removeLabel}
        title={disabled ? "At the minimum already" : removeLabel}
        onClick={onRemove}
        disabled={disabled}
        className="border border-border px-1.5 py-0.5 font-mono text-[11px] leading-none text-muted transition hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-25"
      >
        ✕
      </button>
    </div>
  );
}

export function AddItemButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="justify-self-start border border-dashed border-border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition hover:border-accent hover:text-accent-bright"
    >
      + {label}
    </button>
  );
}

/** Shown in the rail when a block has nothing to configure. */
export function NoProps({ what }: { what: string }) {
  return (
    <p className="text-[13px] text-muted">
      {what} has no settings — edit it directly on the page.
    </p>
  );
}

// ---------------------------------------------------------------------------
// Asset upload
// ---------------------------------------------------------------------------

export interface UploadedAsset {
  url: string;
  filename: string;
  /** Display-only, e.g. "PDF · 2.4 MB". */
  meta: string;
}

/**
 * Upload a file and hand the caller its URL.
 *
 * Uploading is the one editor action that genuinely needs the server, so it is
 * the one place with its own progress state. It does NOT touch the block — the
 * caller decides which field the URL lands in, which keeps this reusable for
 * image, pdf and each row of a file list.
 */
export function AssetUpload({
  label,
  accept,
  onUploaded,
}: {
  label: string;
  accept: string;
  onUploaded: (asset: UploadedAsset) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  return (
    <div className="grid gap-1">
      <label
        htmlFor={inputId}
        className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted"
      >
        {label}
      </label>
      <input
        id={inputId}
        type="file"
        accept={accept}
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setError(null);
          try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/notes/asset", {
              method: "POST",
              body: fd,
            });
            const data = (await res.json()) as Partial<UploadedAsset> & {
              error?: string;
            };
            if (!res.ok || !data.url) {
              throw new Error(data.error || `Upload failed (${res.status})`);
            }
            onUploaded({
              url: data.url,
              filename: data.filename ?? file.name,
              meta: data.meta ?? "",
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
          } finally {
            setBusy(false);
            // Clear the input so re-picking the same file fires onChange again.
            e.target.value = "";
          }
        }}
        className="block w-full text-[12px] text-muted file:mr-2 file:border file:border-border file:bg-well file:px-2 file:py-1 file:font-mono file:text-[11px] file:uppercase file:tracking-[0.14em] file:text-accent hover:file:border-accent"
      />
      {busy ? (
        <span className="text-[11px] text-gold">Uploading…</span>
      ) : null}
      {error ? <span className="text-[11px] text-danger">{error}</span> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paste normalization
// ---------------------------------------------------------------------------

/**
 * Paste a share link or a whole `<iframe>` snippet and get back the fields the
 * block actually stores.
 *
 * Worth keeping from the old builder: nobody has the Bunny GUID to hand, they
 * have the embed code the provider gave them. Requiring the clean value is the
 * kind of small friction that makes an authoring tool annoying.
 */
export function PasteNormalize({
  label,
  hint,
  kind,
  provider,
  onResult,
}: {
  label: string;
  hint: string;
  kind: "video" | "embed";
  provider?: "youtube" | "bunny";
  onResult: (result: Record<string, unknown>) => void;
}) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!raw.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/notes/asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, raw, provider }),
      });
      if (!res.ok) throw new Error(`Could not read that (${res.status})`);
      onResult((await res.json()) as Record<string, unknown>);
      setRaw("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={hint}
        aria-label={label}
        rows={2}
        className="w-full resize-y border border-border bg-well p-2 font-mono text-[11px] text-foreground outline-none focus:border-accent"
      />
      <button
        type="button"
        onClick={run}
        disabled={busy || !raw.trim()}
        className="justify-self-start border border-border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-accent transition hover:border-accent disabled:opacity-30"
      >
        {busy ? "Reading…" : "Use this"}
      </button>
      {error ? <span className="text-[11px] text-danger">{error}</span> : null}
    </div>
  );
}
