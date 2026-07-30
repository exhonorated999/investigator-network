"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

/**
 * Light / dark switch. The actual theme is applied to <html data-theme> by a
 * no-flash inline script in the root layout before paint; this component just
 * reflects and flips that attribute, persisting the choice to localStorage.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current =
      document.documentElement.getAttribute("data-theme") === "light"
        ? "light"
        : "dark";
    setTheme(current);
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    const root = document.documentElement;
    if (next === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode — ignore */
    }
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="grid h-8 w-8 place-items-center border border-border-strong text-muted transition hover:border-accent-bright hover:text-accent-bright"
      // Avoid a hydration mismatch flash: render neutral until mounted.
      style={{ opacity: mounted ? 1 : 0.6 }}
    >
      {isDark ? (
        // Sun — click to go light
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // Moon — click to go dark
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
