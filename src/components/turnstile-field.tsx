"use client";

import { useEffect, useRef } from "react";

type TurnstileTheme = "light" | "dark";

type RenderOptions = {
  sitekey: string;
  theme?: TurnstileTheme | "auto";
  appearance?: "always" | "execute" | "interaction-only";
  callback?: (token: string) => void;
  "error-callback"?: (code?: string) => void;
  "expired-callback"?: () => void;
};

type TurnstileApi = {
  render: (element: HTMLElement, options: RenderOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "cf-turnstile-api";
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Visible Managed Turnstile checkbox.
 *
 * `next/script` plus `appearance: "interaction-only"` left an empty shell:
 * the challenge iframe lives in a closed shadow root, React updates could
 * detach it ("Cannot find Widget"), and a submit with no token showed
 * "confirm you're human" with nothing to click. This renders explicitly
 * into a stable node and paints the widget again if that node is cleared.
 */
export function TurnstileField({
  siteKey,
  resetSignal,
}: {
  siteKey: string;
  resetSignal: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const host: HTMLDivElement = container;
    let removed = false;

    function render() {
      if (removed || !host.isConnected || !window.turnstile) return;
      if (widgetIdRef.current && host.childElementCount > 0) return;
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* The node is already gone. */
        }
        widgetIdRef.current = null;
      }
      const theme: TurnstileTheme =
        document.documentElement.getAttribute("data-theme") === "light"
          ? "light"
          : "dark";
      widgetIdRef.current = window.turnstile.render(host, {
        sitekey: siteKey,
        theme,
        appearance: "always",
        "error-callback": () => {
          const id = widgetIdRef.current;
          if (id) window.turnstile?.reset(id);
        },
      });
    }

    if (window.turnstile) {
      render();
    } else {
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
    }

    // React can drop the shadow host on a later render without remounting
    // this effect. Put the checkbox back if the container is emptied.
    const timer = window.setInterval(render, 1000);

    return () => {
      removed = true;
      window.clearInterval(timer);
      const id = widgetIdRef.current;
      widgetIdRef.current = null;
      if (id) {
        try {
          window.turnstile?.remove(id);
        } catch {
          /* already removed */
        }
      }
    };
  }, [siteKey]);

  useEffect(() => {
    if (!resetSignal) return;
    const id = widgetIdRef.current;
    if (!id || !window.turnstile) return;
    window.turnstile.reset(id);
  }, [resetSignal]);

  return (
    <div id="human-check" className="flex flex-col gap-2">
      <div ref={containerRef} className="min-h-[65px]" />
    </div>
  );
}
