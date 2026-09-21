"use client";

// Error boundary for the whole /admin segment. Instead of the browser's raw
// "this page couldn't load" screen (which is what a server 500 or a transient
// deploy-window blip shows), render a friendly retry. The `digest` correlates
// to the server logs so a stubborn error can be traced.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="reveal mx-auto max-w-lg py-16 text-center">
      <p className="eyebrow eyebrow-gold">// ADMIN CONSOLE</p>
      <h1 className="display-sm mt-3 text-foreground">Something didn’t load</h1>
      <p className="mt-2 text-[15px] text-muted">
        This is usually a brief hiccup — often right after a deploy while the
        server finishes booting. Give it a moment, then try again.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button onClick={() => reset()} className="btn btn-primary">
          Try again
        </button>
        <a href="/admin" className="btn btn-ghost">
          Back to dashboard
        </a>
      </div>
      {error.digest ? (
        <p className="mt-6 font-mono text-[11px] text-muted">
          Reference: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
