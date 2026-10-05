"use client";

import { useSyncExternalStore } from "react";
import { X } from "lucide-react";
import type { ActiveAnnouncement } from "@/lib/announcements";

const DISMISSED_KEY = "sea-announcement-dismissed";
// localStorage's own "storage" event never fires in the tab that wrote it —
// only other tabs get it — so dismissing needs its own event to make this
// tab's useSyncExternalStore re-read the value immediately. "storage" is
// also listened for, so dismissing in one tab hides the banner in every
// other open tab too, for free.
const DISMISS_EVENT = "sea-announcement-dismissed-change";

function subscribe(callback: () => void) {
  window.addEventListener(DISMISS_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(DISMISS_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function readDismissed(announcement: ActiveAnnouncement | null): boolean {
  if (!announcement) return true;
  try {
    return localStorage.getItem(DISMISSED_KEY) === announcement.id;
  } catch {
    return false;
  }
}

// A sticky banner across the very top of the app, above the sidebar and
// topbar alike, so it reaches every role through the one shared AppShell.
// Dismissal is per-device (localStorage), keyed by this announcement's id —
// dismissing one never hides a later, different announcement, and a
// private window or cleared storage just shows it again, which is fine for
// a "have you seen this" banner rather than a one-time system message.
//
// Reading localStorage can only happen after mount (it doesn't exist during
// server rendering), so useSyncExternalStore's server snapshot answers
// "dismissed" unconditionally — the banner never flashes into view on first
// paint only to disappear once the real, already-dismissed value loads.
export function AnnouncementBanner({ announcement }: { announcement: ActiveAnnouncement | null }) {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => readDismissed(announcement),
    () => true,
  );

  if (!announcement || dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, announcement!.id);
    } catch {
      // Private window or storage disabled — the banner just won't stay
      // dismissed across a reload, which is a minor inconvenience, not a bug
      // worth surfacing.
    }
    window.dispatchEvent(new Event(DISMISS_EVENT));
  }

  const toneClass = announcement.tone === "WARNING" ? "bg-warning-bg text-warning" : "bg-primary text-white";

  return (
    // z-20: above ordinary page content, but below the mobile nav's backdrop
    // (z-30) and drawer (z-40) — opening the mobile menu should cover the
    // banner like everything else, not float above it.
    <div className={`sticky top-0 z-20 flex items-start justify-center gap-3 px-4 py-2.5 text-caption ${toneClass}`}>
      <p className="m-0 text-center leading-snug">
        {announcement.message}
        {announcement.linkUrl && (
          <a href={announcement.linkUrl} target="_blank" rel="noreferrer" className="ml-2 font-medium underline underline-offset-2">
            {announcement.linkLabel || "Learn more"}
          </a>
        )}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="grid h-5 w-5 flex-none place-items-center rounded hover:bg-black/10"
      >
        <X size={13} strokeWidth={2} />
      </button>
    </div>
  );
}
