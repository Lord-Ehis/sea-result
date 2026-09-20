"use client";

import { useState, useTransition } from "react";
import { retryNotifications } from "./actions";

export function RetryButton({ ids, label }: { ids?: string[]; label: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run() {
    setMessage(null);
    startTransition(async () => {
      const out = await retryNotifications(ids);
      setMessage(
        out.sent + out.failed === 0
          ? "Nothing to retry."
          : `${out.sent} sent${out.failed ? `, ${out.failed} still failing` : ""}.`,
      );
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex h-8 items-center rounded-md border border-border bg-bg-card px-3 text-caption font-medium text-text-secondary hover:bg-bg-page disabled:opacity-50"
      >
        {pending ? "Retrying…" : label}
      </button>
      {message && <span className="text-caption text-text-muted">{message}</span>}
    </span>
  );
}
