"use client";

import { useState, useTransition } from "react";
import { grantComplimentaryAccess } from "../actions";

// Gives a school access without a payment (a pilot, a partner school, a fix for
// a billing problem). It is recorded as a zero-amount, "complimentary"
// subscription, so it shows in the school's history and expires like any other.
export function ComplimentaryAccessPanel({ schoolId }: { schoolId: string }) {
  const [until, setUntil] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await grantComplimentaryAccess({ schoolId, until, note });
      setMessage(result.ok ? { ok: true, text: "Complimentary access granted." } : { ok: false, text: result.error });
      if (result.ok) {
        setUntil("");
        setNote("");
      }
    });
  }

  return (
    <section className="mb-7 overflow-hidden rounded-md border border-border bg-bg-card">
      <div className="border-b border-border px-5 py-5">
        <h2 className="m-0 text-heading font-medium text-text-primary">Grant complimentary access</h2>
        <p className="mt-1.5 text-caption text-text-muted">Gives this school access until the date you choose, without a payment. Recorded in its subscription history.</p>
      </div>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 p-5">
        <label className="grid gap-1.5 text-[10px] text-text-muted">
          Access until
          <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} required className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary" />
        </label>
        <label className="grid min-w-[240px] flex-1 gap-1.5 text-[10px] text-text-muted">
          Reason
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Pilot school for the 2026/2027 session" required className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary" />
        </label>
        <button type="submit" disabled={pending} className="h-10 rounded-md border border-primary bg-primary px-4 text-caption font-medium text-white disabled:opacity-60">
          {pending ? "Granting…" : "Grant access"}
        </button>
        {message && <p className={`m-0 w-full text-caption ${message.ok ? "text-success" : "text-danger"}`}>{message.text}</p>}
      </form>
    </section>
  );
}
