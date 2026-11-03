"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

type TurnstileTheme = "light" | "dark";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      theme?: TurnstileTheme | "auto";
      appearance?: "always" | "execute" | "interaction-only";
      "response-field"?: boolean;
      "response-field-name"?: string;
    }
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Managed Turnstile widget. `interaction-only` stays invisible unless
 * Cloudflare asks the visitor to solve a challenge. The token is written
 * to a hidden `cf-turnstile-response` input inside the surrounding form.
 * `resetSignal` changes after a rejected token so the next submit gets a
 * fresh one (tokens are single-use and expire after five minutes).
 */
export function TurnstileField({
  siteKey,
  resetSignal,
}: {
  siteKey: string;
  resetSignal: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const mountRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;

    function mount() {
      const container = containerRef.current;
      if (cancelled || !container || !window.turnstile || widgetId.current) return;
      const theme: TurnstileTheme =
        document.documentElement.getAttribute("data-theme") === "light"
          ? "light"
          : "dark";
      widgetId.current = window.turnstile.render(container, {
        sitekey: siteKey,
        theme,
        appearance: "interaction-only",
        "response-field": true,
        "response-field-name": "cf-turnstile-response",
      });
    }

    mountRef.current = mount;
    mount();

    return () => {
      cancelled = true;
      mountRef.current = () => {};
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [siteKey]);

  useEffect(() => {
    if (!resetSignal || !widgetId.current || !window.turnstile) return;
    window.turnstile.reset(widgetId.current);
  }, [resetSignal]);

  return (
    <div className="flex flex-col gap-2">
      <Script
        src={SCRIPT_SRC}
        strategy="afterInteractive"
        onLoad={() => mountRef.current()}
      />
      <div ref={containerRef} />
      <p className="font-mono text-[10px] leading-relaxed text-muted">
        A Cloudflare check runs with this form. If it never finishes, allow
        challenges.cloudflare.com and try again.
      </p>
    </div>
  );
}
