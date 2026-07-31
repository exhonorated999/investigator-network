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
import { type Block, type BlockType, emptyBlock } from "@/lib/blocks";
import {
  type ListRef,
  duplicateBlockById,
  findLoc,
  insertAfter,
  insertBlockAt,
  moveBlockTo,
  nudgeBlock,
  patchBlock,
  removeBlockById,
  updateBlockById,
} from "@/lib/notes-doc";

/**
 * The visual editor's document store.
 *
 * This inverts the old builder completely. There, the database was the single
 * source of truth and every keystroke-sized edit was a form POST that
 * re-rendered the page. Here the client owns the document, edits are local and
 * instant, and persistence is a debounced background save.
 *
 * Consequences that shape the code below:
 *
 *  - **Undo has to exist.** With no per-edit Save button there is no natural
 *    "I didn't mean that" boundary, so every mutation pushes the previous tree
 *    onto a history stack. The trees are small and structurally shared, so
 *    keeping 50 of them is cheap.
 *  - **Saves must not overlap.** A slow request finishing after a fast one
 *    would write a stale document, so only one save is ever in flight and any
 *    edits made during it mark the document dirty again.
 *  - **Leaving must not lose work.** A pending debounce is flushed on tab hide
 *    and warned about on unload.
 */

const HISTORY_LIMIT = 50;
const DEBOUNCE_MS = 700;

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

interface EditorStore {
  blocks: Block[];
  selectedId: string | null;
  saveState: SaveState;
  lastSavedAt: string | null;
  canUndo: boolean;
  canRedo: boolean;

  select: (id: string | null) => void;
  patch: (id: string, patch: Record<string, unknown>) => void;
  update: (id: string, fn: (block: Block) => Block) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  nudge: (id: string, dir: -1 | 1) => void;
  insertAt: (ref: ListRef, index: number, type: BlockType) => void;
  insertAfterId: (siblingId: string, type: BlockType) => void;
  move: (id: string, ref: ListRef, index: number) => void;
  replaceAll: (blocks: Block[]) => void;
  undo: () => void;
  redo: () => void;
  saveNow: () => void;
}

const Ctx = createContext<EditorStore | null>(null);

export function useEditor(): EditorStore {
  const store = useContext(Ctx);
  if (!store) {
    throw new Error("useEditor must be used inside <EditorProvider>");
  }
  return store;
}

export function EditorProvider({
  unitId,
  initialBlocks,
  children,
}: {
  unitId: string;
  initialBlocks: Block[];
  children: ReactNode;
}) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const past = useRef<Block[][]>([]);
  const future = useRef<Block[][]>([]);
  const [historyTick, setHistoryTick] = useState(0);

  // Mirrors of state for callbacks that must not close over a stale render.
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const inFlight = useRef(false);
  const pendingDirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- persistence --------------------------------------------------------

  const flush = useCallback(async () => {
    if (inFlight.current) {
      // A save is already running; mark that another is needed once it lands.
      pendingDirty.current = true;
      return;
    }
    inFlight.current = true;
    pendingDirty.current = false;
    setSaveState("saving");

    try {
      const res = await fetch("/api/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, blocks: blocksRef.current }),
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      const data = (await res.json()) as { savedAt: string };
      setLastSavedAt(data.savedAt);
      setSaveState(pendingDirty.current ? "dirty" : "saved");
    } catch {
      // Deliberately keep the local document. The next edit retries, and the
      // beforeunload guard stops the admin walking away unaware.
      setSaveState("error");
    } finally {
      inFlight.current = false;
      if (pendingDirty.current) {
        pendingDirty.current = false;
        void flush();
      }
    }
  }, [unitId]);

  const scheduleSave = useCallback(() => {
    setSaveState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void flush();
    }, DEBOUNCE_MS);
  }, [flush]);

  const saveNow = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    void flush();
  }, [flush]);

  // Flush on tab hide rather than only on unload: `visibilitychange` is the
  // one lifecycle event mobile and background-tab cases reliably fire.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void flush();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [flush]);

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (saveState === "dirty" || saveState === "saving" || saveState === "error") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [saveState]);

  // --- mutation -----------------------------------------------------------

  /**
   * The single funnel every edit goes through: push history, set the new tree,
   * schedule a save. Nothing calls setBlocks directly.
   */
  const commit = useCallback(
    (next: Block[]) => {
      const prev = blocksRef.current;
      if (next === prev) return;
      past.current = [...past.current.slice(-(HISTORY_LIMIT - 1)), prev];
      future.current = [];
      blocksRef.current = next;
      setBlocks(next);
      setHistoryTick((t) => t + 1);
      scheduleSave();
    },
    [scheduleSave]
  );

  const patch = useCallback(
    (id: string, p: Record<string, unknown>) => {
      commit(patchBlock(blocksRef.current, id, p));
    },
    [commit]
  );

  const update = useCallback(
    (id: string, fn: (block: Block) => Block) => {
      commit(updateBlockById(blocksRef.current, id, fn));
    },
    [commit]
  );

  const remove = useCallback(
    (id: string) => {
      // Selecting nothing afterwards avoids a properties panel pointing at a
      // block that no longer exists.
      if (selectedId === id) setSelectedId(null);
      commit(removeBlockById(blocksRef.current, id));
    },
    [commit, selectedId]
  );

  const duplicate = useCallback(
    (id: string) => commit(duplicateBlockById(blocksRef.current, id)),
    [commit]
  );

  const nudge = useCallback(
    (id: string, dir: -1 | 1) => commit(nudgeBlock(blocksRef.current, id, dir)),
    [commit]
  );

  const insertAt = useCallback(
    (ref: ListRef, index: number, type: BlockType) => {
      const block = emptyBlock(type);
      commit(insertBlockAt(blocksRef.current, ref, index, block));
      setSelectedId(block.id);
    },
    [commit]
  );

  const insertAfterId = useCallback(
    (siblingId: string, type: BlockType) => {
      const block = emptyBlock(type);
      commit(insertAfter(blocksRef.current, siblingId, block));
      setSelectedId(block.id);
    },
    [commit]
  );

  const move = useCallback(
    (id: string, ref: ListRef, index: number) => {
      commit(moveBlockTo(blocksRef.current, id, ref, index));
    },
    [commit]
  );

  const replaceAll = useCallback(
    (next: Block[]) => commit(next),
    [commit]
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current = [blocksRef.current, ...future.current];
    blocksRef.current = prev;
    setBlocks(prev);
    setHistoryTick((t) => t + 1);
    scheduleSave();
  }, [scheduleSave]);

  const redo = useCallback(() => {
    const [next, ...rest] = future.current;
    if (!next) return;
    future.current = rest;
    past.current = [...past.current, blocksRef.current];
    blocksRef.current = next;
    setBlocks(next);
    setHistoryTick((t) => t + 1);
    scheduleSave();
  }, [scheduleSave]);

  // --- keyboard -----------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        // Undo works while typing too — it is the escape hatch for a bad edit.
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveNow();
        return;
      }
      if (typing) return;

      if (e.key === "Escape") setSelectedId(null);
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        remove(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, saveNow, selectedId, remove]);

  const store = useMemo<EditorStore>(
    () => ({
      blocks,
      selectedId,
      saveState,
      lastSavedAt,
      canUndo: past.current.length > 0,
      canRedo: future.current.length > 0,
      select: setSelectedId,
      patch,
      update,
      remove,
      duplicate,
      nudge,
      insertAt,
      insertAfterId,
      move,
      replaceAll,
      undo,
      redo,
      saveNow,
    }),
    // historyTick is the signal that canUndo/canRedo changed — the refs it
    // reads from are mutable and would not otherwise trigger a re-render.
    [
      blocks, selectedId, saveState, lastSavedAt, historyTick,
      patch, update, remove, duplicate, nudge, insertAt, insertAfterId,
      move, replaceAll, undo, redo, saveNow,
    ]
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

/** Where a block sits, for drag targets and sibling-relative inserts. */
export function useBlockLoc(id: string) {
  const { blocks } = useEditor();
  return useMemo(() => findLoc(blocks, id), [blocks, id]);
}
