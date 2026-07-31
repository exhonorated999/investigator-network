"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/* ------------------------------------------------------------------ context */

export interface DockVideo {
  src: string;
  title: string;
  duration?: string;
}

interface DockCtx {
  active: DockVideo | null;
  /** False when no provider is mounted — see `NO_DOCK` below. */
  available: boolean;
  /** Pop a video out into the persistent floating window. */
  open: (v: DockVideo) => void;
  /** Close the floating window. */
  close: () => void;
}

const Ctx = createContext<DockCtx | null>(null);

/**
 * The dock is mounted by the course layout, but video blocks also render
 * outside it — most notably in the admin notes preview, which shows the real
 * learner components on an admin route. Rather than crash the host page, fall
 * back to a dock that can never open. Callers use `available` to hide the
 * pop-out control instead of offering a button that does nothing.
 */
const NO_DOCK: DockCtx = {
  active: null,
  available: false,
  open: () => {},
  close: () => {},
};

export function usePlayerDock(): DockCtx {
  return useContext(Ctx) ?? NO_DOCK;
}

/* --------------------------------------------- Document Picture-in-Picture */

interface DocumentPiP {
  requestWindow(opts?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
}

/** The Document PiP entry point, when the browser supports it (Chrome/Edge). */
function getDocumentPiP(): DocumentPiP | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { documentPictureInPicture?: DocumentPiP })
      .documentPictureInPicture ?? null
  );
}

/**
 * Hosts a persistent mini-player. When the browser supports the Document
 * Picture-in-Picture API (Chrome/Edge), popping out opens a REAL floating OS
 * window that stays on top of everything — even other apps — so the learner
 * can watch while working elsewhere. Browsers without the API fall back to the
 * in-page draggable dock. Either way the player is mounted once in the course
 * layout, so it survives navigation between units.
 */
export function PlayerDockProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<DockVideo | null>(null);
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
  const [pipPending, setPipPending] = useState(false);
  const pipRef = useRef<Window | null>(null);

  const close = useCallback(() => {
    if (pipRef.current) {
      try {
        pipRef.current.close();
      } catch {
        /* window already gone */
      }
    }
    pipRef.current = null;
    setPipContainer(null);
    setPipPending(false);
    setActive(null);
  }, []);

  const open = useCallback((v: DockVideo) => {
    setActive(v);

    const dpip = getDocumentPiP();
    if (!dpip?.requestWindow) return; // no API → in-page dock fallback

    setPipPending(true);
    // Must be called during the click gesture; requestWindow() is invoked
    // synchronously here, we just await the returned promise.
    dpip
      .requestWindow({ width: 480, height: 300 })
      .then((w) => {
        const style = w.document.createElement("style");
        style.textContent =
          "*{box-sizing:border-box}html,body{margin:0;height:100%;background:#000;" +
          "overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}";
        w.document.head.appendChild(style);

        const container = w.document.createElement("div");
        container.style.cssText =
          "position:fixed;inset:0;display:flex;flex-direction:column";
        w.document.body.appendChild(container);

        w.addEventListener("pagehide", () => {
          pipRef.current = null;
          setPipContainer(null);
          setPipPending(false);
          setActive(null);
        });

        pipRef.current = w;
        setPipContainer(container);
        setPipPending(false);
      })
      .catch(() => {
        // Denied / not allowed → keep the in-page dock.
        setPipPending(false);
      });
  }, []);

  // Close the pop-out window if the provider itself unmounts.
  useEffect(() => {
    return () => {
      if (pipRef.current) {
        try {
          pipRef.current.close();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  return (
    <Ctx.Provider value={{ active, available: true, open, close }}>
      {children}
      {active && pipContainer
        ? createPortal(<PipPlayer video={active} onClose={close} />, pipContainer)
        : active && !pipPending
          ? <PlayerDock active={active} onClose={close} />
          : null}
    </Ctx.Provider>
  );
}

/** Player rendered inside the real PiP window. Inline styles only — that
 *  document has no Tailwind. */
function PipPlayer({
  video,
  onClose,
}: {
  video: DockVideo;
  onClose: () => void;
}) {
  return (
    <>
      <div
        style={{
          height: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "0 10px",
          background: "#0a0c11",
          borderBottom: "1px solid rgba(0,180,216,0.28)",
        }}
      >
        <span
          style={{
            color: "#8899aa",
            fontSize: 11,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {video.title}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            flexShrink: 0,
            background: "transparent",
            border: "1px solid rgba(0,180,216,0.4)",
            color: "#90e0ef",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            padding: "3px 8px",
            cursor: "pointer",
          }}
        >
          ⇤ Return inline
        </button>
      </div>
      <div style={{ position: "relative", flex: 1, background: "#000" }}>
        <iframe
          src={video.src}
          title={video.title}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: 0,
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    </>
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
          className="flex cursor-grab items-center justify-between gap-2 border-b border-border bg-well-strong px-3 active:cursor-grabbing"
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
