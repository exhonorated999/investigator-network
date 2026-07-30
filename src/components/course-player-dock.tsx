"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/* ------------------------------------------------------------------ context */

export interface DockVideo {
  src: string;
  title: string;
  duration?: string;
}

interface DockCtx {
  active: DockVideo | null;
  /** Pop a video out into the persistent floating window. */
  open: (v: DockVideo) => void;
  /** Close the floating window. */
  close: () => void;
}

const Ctx = createContext<DockCtx | null>(null);

export function usePlayerDock(): DockCtx {
  const c = useContext(Ctx);
  if (!c) {
    throw new Error("usePlayerDock must be used inside <PlayerDockProvider>");
  }
  return c;
}

/**
 * Hosts a persistent, draggable mini-player. Mounted once in the course
 * layout so the Bunny iframe survives navigation between units — the learner
 * can pop a video out, walk over to the Course Notes, and keep watching.
 */
export function PlayerDockProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<DockVideo | null>(null);
  const open = useCallback((v: DockVideo) => setActive(v), []);
  const close = useCallback(() => setActive(null), []);

  return (
    <Ctx.Provider value={{ active, open, close }}>
      {children}
      <PlayerDock active={active} onClose={close} />
    </Ctx.Provider>
  );
}

/* --------------------------------------------------------------- the window */

const HEADER_H = 34;
const MIN_W = 280;
const MAX_W = 720;
const MARGIN = 20;

interface Pos {
  left: number;
  top: number;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function PlayerDock({
  active,
  onClose,
}: {
  active: DockVideo | null;
  onClose: () => void;
}) {
  const [pos, setPos] = useState<Pos | null>(null);
  const [width, setWidth] = useState(440);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{
    mode: "move" | "resize";
    px: number;
    py: number;
    startLeft: number;
    startTop: number;
    startW: number;
  } | null>(null);

  const videoH = Math.round((width * 9) / 16);
  const totalH = videoH + HEADER_H;

  // First open → anchor bottom-right. Reset when closed so the next open is
  // predictable.
  useEffect(() => {
    if (active && !pos) {
      const w = 440;
      setWidth(w);
      const h = Math.round((w * 9) / 16) + HEADER_H;
      setPos({
        left: window.innerWidth - w - MARGIN,
        top: window.innerHeight - h - MARGIN,
      });
    }
    if (!active) setPos(null);
  }, [active, pos]);

  // Keep the window on-screen if the viewport shrinks.
  useEffect(() => {
    if (!active) return;
    function onResize() {
      setPos((p) => {
        if (!p) return p;
        return {
          left: clamp(p.left, MARGIN, window.innerWidth - width - MARGIN),
          top: clamp(p.top, MARGIN, window.innerHeight - totalH - MARGIN),
        };
      });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active, width, totalH]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.px;
    const dy = e.clientY - g.py;
    if (g.mode === "move") {
      const w = g.startW;
      const h = Math.round((w * 9) / 16) + HEADER_H;
      setPos({
        left: clamp(g.startLeft + dx, MARGIN, window.innerWidth - w - MARGIN),
        top: clamp(g.startTop + dy, MARGIN, window.innerHeight - h - MARGIN),
      });
    } else {
      const maxByViewport = window.innerWidth - g.startLeft - MARGIN;
      const next = clamp(g.startW + dx, MIN_W, Math.min(MAX_W, maxByViewport));
      setWidth(next);
    }
  }, []);

  const endGesture = useCallback(() => {
    gesture.current = null;
    setDragging(false);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endGesture);
  }, [onPointerMove]);

  const startMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pos) return;
      e.preventDefault();
      gesture.current = {
        mode: "move",
        px: e.clientX,
        py: e.clientY,
        startLeft: pos.left,
        startTop: pos.top,
        startW: width,
      };
      setDragging(true);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endGesture);
    },
    [pos, width, onPointerMove, endGesture],
  );

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      if (!pos) return;
      e.preventDefault();
      e.stopPropagation();
      gesture.current = {
        mode: "resize",
        px: e.clientX,
        py: e.clientY,
        startLeft: pos.left,
        startTop: pos.top,
        startW: width,
      };
      setDragging(true);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endGesture);
    },
    [pos, width, onPointerMove, endGesture],
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endGesture);
    };
  }, [onPointerMove, endGesture]);

  if (!active || !pos) return null;

  return (
    <div
      className="fixed z-[70] select-none shadow-[0_18px_48px_-12px_rgba(0,0,0,0.8)]"
      style={{ left: pos.left, top: pos.top, width }}
    >
      <div className="bracket relative border border-border-strong bg-surface">
        {/* header / drag handle */}
        <div
          onPointerDown={startMove}
          className="flex cursor-grab items-center justify-between gap-2 border-b border-border bg-[rgba(10,12,17,0.9)] px-3 active:cursor-grabbing"
          style={{ height: HEADER_H }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="tag-chip tag-chip-cyan shrink-0 !py-0 !text-[9px]">
              // PLAYBACK
            </span>
            <span className="truncate font-mono text-[11px] text-muted">
              {active.title}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {active.duration ? (
              <span className="font-mono text-[10px] tracking-[0.14em] text-muted">
                {active.duration}
              </span>
            ) : null}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onClose}
              aria-label="Close pop-out"
              className="grid h-5 w-5 place-items-center border border-border text-muted transition hover:border-accent hover:text-accent-bright"
            >
              <span className="text-xs leading-none">×</span>
            </button>
          </div>
        </div>

        {/* video */}
        <div className="relative bg-black" style={{ height: videoH }}>
          <iframe
            key={active.src}
            className="absolute inset-0 h-full w-full"
            src={active.src}
            title={active.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
          {/* pointer shield so dragging/resizing doesn't get eaten by the iframe */}
          {dragging ? <div className="absolute inset-0 cursor-grabbing" /> : null}
        </div>

        {/* resize handle */}
        <div
          onPointerDown={startResize}
          aria-hidden
          className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
          style={{
            background:
              "linear-gradient(135deg, transparent 0 55%, var(--accent) 55% 62%, transparent 62% 74%, var(--accent) 74% 81%, transparent 81%)",
            opacity: 0.7,
          }}
        />
      </div>
    </div>
  );
}
