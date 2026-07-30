"use client";

import { usePlayerDock } from "./course-player-dock";

/**
 * Inline video with a "Pop out" control. When popped out, the actual iframe
 * moves to the persistent floating dock (which survives navigation), and the
 * inline slot shows a lightweight placeholder + a way to bring it back.
 */
export function VideoPlayer({
  src,
  title,
  duration,
}: {
  src: string;
  title: string;
  duration?: string;
}) {
  const dock = usePlayerDock();
  const popped = dock.active?.src === src;

  return (
    <div className="bracket scanlines relative">
      <span className="tag-chip tag-chip-cyan absolute -top-3 left-4 z-10">
        // PLAYBACK
      </span>

      <button
        type="button"
        onClick={() =>
          popped ? dock.close() : dock.open({ src, title, duration })
        }
        className="absolute -top-3 right-4 z-10 flex items-center gap-1.5 border border-border-strong bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition hover:border-accent hover:text-accent-bright"
      >
        {popped ? (
          <>
            <span aria-hidden>⇤</span> Return inline
          </>
        ) : (
          <>
            <span aria-hidden>⧉</span> Pop out
          </>
        )}
      </button>

      <div className="overflow-hidden border border-border bg-black">
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          {popped ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-bright">
                Playing in pop-out
              </span>
              <p className="max-w-xs font-mono text-xs text-muted">
                The video opened in a floating window that stays on top — move it
                anywhere, even outside the browser, and keep watching while you
                read your Course Notes.
              </p>
              <button
                type="button"
                onClick={() => dock.close()}
                className="btn btn-ghost btn-sm"
              >
                ⇤ Return to inline
              </button>
            </div>
          ) : (
            <iframe
              className="absolute inset-0 h-full w-full"
              src={src}
              title={title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          )}
        </div>
      </div>
    </div>
  );
}
