"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Client shell around the (server-rendered) notes builder.
 *
 * The builder itself stays a server component: every edit is a form posting to
 * a server action. That means the whole tree re-renders after each save, which
 * would wipe any collapse state held in the DOM — so it is held here instead,
 * above the re-rendered subtree, and mirrored into localStorage so it also
 * survives a hard refresh or a navigation away and back.
 *
 * Two rules shape everything below:
 *
 *   1. Collapsed blocks are HIDDEN, never unmounted. The field inputs are
 *      uncontrolled `defaultValue` inputs; unmounting them would silently throw
 *      away whatever the author had typed but not yet saved.
 *   2. Nothing reads localStorage during render. The first client render must
 *      match the server's, so stored state is applied in an effect.
 */

// ---------------------------------------------------------------------------
// Collapse state
// ---------------------------------------------------------------------------

interface CollapseStore {
  /** Applies to any block with no explicit entry in `overrides`. */
  fallbackOpen: boolean;
  overrides: Record<string, boolean>;
  isOpen: (blockId: string) => boolean;
  toggle: (blockId: string) => void;
  setAll: (open: boolean) => void;
  register: (blockId: string) => void;
  unregister: (blockId: string) => void;
  collapsedCount: number;
  totalCount: number;
}

const CollapseCtx = createContext<CollapseStore | null>(null);

/**
 * Blocks nested inside a container render outside any provider in some code
 * paths; an always-open inert store keeps them working rather than crashing.
 */
const INERT: CollapseStore = {
  fallbackOpen: true,
  overrides: {},
  isOpen: () => true,
  toggle: () => {},
  setAll: () => {},
  register: () => {},
  unregister: () => {},
  collapsedCount: 0,
  totalCount: 0,
};

export function useCollapse(): CollapseStore {
  return useContext(CollapseCtx) ?? INERT;
}

interface Persisted {
  fallbackOpen: boolean;
  overrides: Record<string, boolean>;
  showPreview: boolean;
}

function read(key: string): Partial<Persisted> {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Partial<Persisted>;
  } catch {
    // Private browsing, quota, corrupt value — none of it is worth an error.
    return {};
  }
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export function NotesWorkspace({
  storageKey,
  builder,
  preview,
  blockCount,
}: {
  storageKey: string;
  /** The server-rendered editor tree. */
  builder: ReactNode;
  /** The server-rendered learner view of the same document. */
  preview: ReactNode;
  blockCount: number;
}) {
  const [fallbackOpen, setFallbackOpen] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [ready, setReady] = useState(false);

  // Ids seen this render pass, so the toolbar can report "8 of 23 collapsed"
  // without the builder having to hand its block list to the client.
  const seen = useRef<Set<string>>(new Set());
  const [registered, setRegistered] = useState<string[]>([]);

  const key = `nb:${storageKey}`;

  useEffect(() => {
    const saved = read(key);
    if (typeof saved.fallbackOpen === "boolean") setFallbackOpen(saved.fallbackOpen);
    if (saved.overrides && typeof saved.overrides === "object") {
      setOverrides(saved.overrides);
    }
    if (typeof saved.showPreview === "boolean") setShowPreview(saved.showPreview);
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready) return; // Never write back the defaults before the load lands.
    try {
      window.localStorage.setItem(
        key,
        JSON.stringify({ fallbackOpen, overrides, showPreview })
      );
    } catch {
      /* storage unavailable — collapse state is a convenience, not data */
    }
  }, [ready, key, fallbackOpen, overrides, showPreview]);

  const register = useCallback((blockId: string) => {
    if (seen.current.has(blockId)) return;
    seen.current.add(blockId);
    setRegistered((prev) => (prev.includes(blockId) ? prev : [...prev, blockId]));
  }, []);

  // A deleted block must stop counting toward "8 collapsed", otherwise the
  // toolbar slowly drifts away from what is actually on screen.
  const unregister = useCallback((blockId: string) => {
    seen.current.delete(blockId);
    setRegistered((prev) => prev.filter((id) => id !== blockId));
  }, []);

  const isOpen = useCallback(
    (blockId: string) => overrides[blockId] ?? fallbackOpen,
    [overrides, fallbackOpen]
  );

  const toggle = useCallback(
    (blockId: string) => {
      setOverrides((prev) => ({
        ...prev,
        [blockId]: !(prev[blockId] ?? fallbackOpen),
      }));
    },
    [fallbackOpen]
  );

  const setAll = useCallback((open: boolean) => {
    // Clearing the overrides is the point: "collapse all" has to beat every
    // per-block decision made earlier, otherwise it only half works.
    setFallbackOpen(open);
    setOverrides({});
  }, []);

  const collapsedCount = registered.filter((id) => !isOpen(id)).length;

  const store = useMemo<CollapseStore>(
    () => ({
      fallbackOpen,
      overrides,
      isOpen,
      toggle,
      setAll,
      register,
      unregister,
      collapsedCount,
      totalCount: registered.length,
    }),
    [fallbackOpen, overrides, isOpen, toggle, setAll, register, unregister, collapsedCount, registered.length]
  );

  return (
    <CollapseCtx.Provider value={store}>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-border py-2">
        <button
          type="button"
          onClick={() => setAll(true)}
          className="btn btn-ghost btn-sm"
        >
          Expand all
        </button>
        <button
          type="button"
          onClick={() => setAll(false)}
          className="btn btn-ghost btn-sm"
        >
          Collapse all
        </button>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          {collapsedCount > 0
            ? `${collapsedCount} collapsed`
            : `${blockCount} block${blockCount === 1 ? "" : "s"}`}
        </span>

        <span className="flex-1" />

        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className={`btn btn-sm ${showPreview ? "btn-primary" : "btn-ghost"}`}
          aria-pressed={showPreview}
        >
          {showPreview ? "Hide preview" : "Show preview"}
        </button>
      </div>

      <div
        className={
          showPreview
            ? "mt-2 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]"
            : "mt-2"
        }
      >
        <div className="min-w-0">{builder}</div>

        {showPreview ? (
          <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
            <div className="flex items-baseline justify-between gap-2">
              <p className="eyebrow eyebrow-gold">Learner view</p>
              <span className="font-mono text-[10px] text-muted">
                updates on save
              </span>
            </div>
            {/* Bounded height so the pane scrolls independently of the form
                instead of the page growing to the taller of the two. */}
            <div className="mt-2 max-h-[calc(100vh-8rem)] overflow-y-auto border border-border bg-[rgba(10,12,17,0.55)] p-4">
              {preview}
            </div>
          </aside>
        ) : null}
      </div>
    </CollapseCtx.Provider>
  );
}

// ---------------------------------------------------------------------------
// Per-block shell
// ---------------------------------------------------------------------------

export function BlockShell({
  blockId,
  label,
  index,
  summary,
  controls,
  children,
}: {
  blockId: string;
  label: string;
  /** One-based position, already formatted. */
  index: string;
  summary: string;
  /** Move / duplicate / delete forms. Server-rendered, passed through. */
  controls: ReactNode;
  children: ReactNode;
}) {
  const { isOpen, toggle, register, unregister } = useCollapse();
  const open = isOpen(blockId);

  useEffect(() => {
    register(blockId);
    return () => unregister(blockId);
  }, [register, unregister, blockId]);

  return (
    <div className="border border-border bg-[rgba(10,12,17,0.55)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={() => toggle(blockId)}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${label} block`}
          className="flex min-w-0 flex-1 items-center gap-2 text-left transition hover:opacity-80"
        >
          <span className="font-mono text-[11px] text-accent">
            {open ? "▾" : "▸"}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent-bright">
            {label}
          </span>
          <span className="font-mono text-[10px] text-muted">{index}</span>
          {summary ? (
            <span className="truncate text-[12px] text-muted">{summary}</span>
          ) : null}
        </button>

        {controls}
      </div>

      {/* Hidden, not unmounted — see the note at the top of this file. */}
      <div className="p-3" hidden={!open}>
        {children}
      </div>
    </div>
  );
}
