"use client";

import { useEffect, useState } from "react";

/** Chrome/Android fires this before showing its native install banner. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 14;

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac but is touch-capable.
  const iPadOS =
    navigator.platform === "MacIntel" &&
    (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints! > 1;
  return iOS || iPadOS;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [visible, setVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    // Already installed, or the user isn't on a mobile/touch context we care
    // about — never show.
    if (isStandalone() || recentlyDismissed()) return;

    const iosDevice = isIOSDevice();
    setIos(iosDevice);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS never fires beforeinstallprompt, so surface the manual instructions
    // sheet on iPhone/iPad Safari.
    if (iosDevice) setVisible(true);

    const onInstalled = () => {
      setVisible(false);
      setSheetOpen(false);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false);
    setSheetOpen(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
      setSheetOpen(false);
    }
    setDeferred(null);
  }

  if (!visible) return null;

  return (
    <>
      {/* Floating pill trigger */}
      {!sheetOpen ? (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 border border-border-strong bg-surface/95 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-accent-bright shadow-2xl backdrop-blur-md transition hover:text-foreground sm:hidden"
          style={{
            marginBottom: "env(safe-area-inset-bottom)",
            borderRadius: 999,
          }}
          aria-label="Install the Investigator Network app"
        >
          <DownloadIcon />
          Get the App
        </button>
      ) : null}

      {/* Bottom sheet */}
      {sheetOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={dismiss}
        >
          <div
            className="w-full max-w-md border-t-2 border-gold/40 bg-surface px-6 pb-8 pt-6 shadow-2xl"
            style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-border-strong" />

            <p className="eyebrow eyebrow-muted text-[9px] text-gold">
              Investigator Network
            </p>
            <h2 className="display-sm mt-1 text-foreground">Get the App</h2>
            <p className="mt-1 text-sm text-muted">
              Add it to your home screen for full-screen, app-like access.
            </p>

            {ios ? (
              <ol className="mt-6 space-y-4">
                <Step icon={<ShareIcon />}>
                  Tap the <strong className="text-foreground">Share</strong>{" "}
                  button in your browser toolbar
                </Step>
                <Step icon={<PlusSquareIcon />}>
                  Scroll and tap{" "}
                  <strong className="text-foreground">Add to Home Screen</strong>
                </Step>
                <Step icon={<CheckIcon />}>
                  Tap <strong className="text-foreground">Add</strong> — you're
                  done
                </Step>
              </ol>
            ) : deferred ? (
              <button
                type="button"
                onClick={install}
                className="mt-6 flex w-full items-center justify-center gap-2 border border-border-strong bg-[rgba(0,180,216,0.1)] px-4 py-3.5 font-mono text-xs uppercase tracking-[0.18em] text-accent-bright transition hover:bg-[rgba(0,180,216,0.18)] hover:text-foreground"
              >
                <DownloadIcon />
                Install App
              </button>
            ) : (
              <ol className="mt-6 space-y-4">
                <Step icon={<DotsIcon />}>
                  Open your browser menu (
                  <strong className="text-foreground">⋮</strong> or{" "}
                  <strong className="text-foreground">⋯</strong>)
                </Step>
                <Step icon={<PlusSquareIcon />}>
                  Choose{" "}
                  <strong className="text-foreground">
                    Install app
                  </strong>{" "}
                  or{" "}
                  <strong className="text-foreground">Add to Home screen</strong>
                </Step>
              </ol>
            )}

            <button
              type="button"
              onClick={dismiss}
              className="mt-6 w-full text-center font-mono text-[11px] uppercase tracking-[0.16em] text-muted transition hover:text-foreground"
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Step({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center border border-border bg-well text-accent-bright">
        {icon}
      </span>
      <span className="text-sm text-muted">{children}</span>
    </li>
  );
}

/* --- inline icons (stroke = currentColor) --- */
function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 15V3m0 0L8 7m4-4 4 4" />
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}
function PlusSquareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}
function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}
