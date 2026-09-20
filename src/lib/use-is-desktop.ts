"use client";

import { useSyncExternalStore } from "react";

// Whether the viewport is at Tailwind's `lg` breakpoint or wider. Lets a
// component render just the layout that's visible instead of both (one hidden
// with CSS), which halves the DOM — and the work per keystroke — on big
// sheets. The server snapshot is "narrow", so the first paint is the mobile
// layout and the client switches after hydration.
const QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
