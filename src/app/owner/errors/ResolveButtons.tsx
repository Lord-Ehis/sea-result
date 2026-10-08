"use client";

import { useTransition } from "react";
import { resolveAllErrors, resolveError } from "./actions";

export function ResolveButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => resolveError(id))}
      className="inline-flex h-8 items-center rounded-md border border-border bg-bg-card px-3 text-caption font-medium text-text-secondary hover:bg-bg-page disabled:opacity-60"
    >
      {pending ? "…" : "Mark fixed"}
    </button>
  );
}

export function ResolveAllButton({ count }: { count: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => resolveAllErrors())}
      className="inline-flex h-8 items-center rounded-md border border-primary bg-primary px-3 text-caption font-medium text-white disabled:opacity-60"
    >
      {pending ? "Working…" : `Mark all ${count} fixed`}
    </button>
  );
}
