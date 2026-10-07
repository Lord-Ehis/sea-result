"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { retryFailedMessages, sendTestMessage, type TestMessageResult } from "./actions";

export type SchoolFailureRow = { schoolId: string; name: string; total: number; sms: number; email: number; retryable: number; notRetryable: number };

const buttonClass = "inline-flex h-8 items-center rounded-md border border-primary bg-primary px-3 text-caption font-medium text-white disabled:opacity-60";

export function FailuresPanel({ schools, retryableTotal, days }: { schools: SchoolFailureRow[]; retryableTotal: number; days: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function retry(schoolId?: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await retryFailedMessages({ schoolId });
      if (!result.ok) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      const parts = [`${result.sent} sent`, result.failed > 0 ? `${result.failed} still failing` : null, result.skipped > 0 ? `${result.skipped} skipped (already handled)` : null].filter(Boolean);
      setMessage({
        ok: result.failed === 0,
        text: `${parts.join(", ")}.${result.moreLeft ? " More are waiting: run it again." : ""}${result.failed > 0 ? " Use the test message below to see why they fail." : ""}`,
      });
      router.refresh();
    });
  }

  return (
    <section className="mb-6 overflow-hidden rounded-md border border-border bg-bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="m-0 text-heading font-medium text-text-primary">Failed messages</h2>
          <p className="mt-1 text-caption text-text-muted">Last {days} days, by school. Only result notifications can be re-sent; password and invite links expire, so those are sent again from Find a user.</p>
        </div>
        {retryableTotal > 0 && (
          <button type="button" onClick={() => retry()} disabled={pending} className={buttonClass}>
            {pending ? "Retrying…" : `Retry all ${retryableTotal}`}
          </button>
        )}
      </div>
      {message && <p className={`m-4 mb-0 rounded-md px-3 py-2 text-caption ${message.ok ? "bg-success-bg text-success" : "bg-warning-bg text-warning"}`}>{message.text}</p>}
      {schools.length === 0 ? (
        <p className="m-0 px-5 py-5 text-caption text-text-muted">No failed messages. Everything that was sent went through.</p>
      ) : (
        schools.map((s) => (
          <div key={s.schoolId} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f2f3] px-5 py-3.5 last:border-0">
            <div className="min-w-0">
              <Link href={`/owner/schools/${s.schoolId}`} className="text-body font-medium text-primary hover:underline">
                {s.name}
              </Link>
              <div className="text-caption text-text-muted">
                {[s.sms > 0 ? `${s.sms} SMS` : null, s.email > 0 ? `${s.email} ${s.email === 1 ? "email" : "emails"}` : null].filter(Boolean).join(" · ")} failed
                {s.notRetryable > 0 ? ` · ${s.notRetryable} can't be re-sent` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill label={`${s.total} failed`} tone="warning" />
              {s.retryable > 0 && (
                <button type="button" onClick={() => retry(s.schoolId)} disabled={pending} className="inline-flex h-8 items-center rounded-md border border-[#cbdde9] bg-bg-card px-3 text-caption font-medium text-primary hover:bg-primary-bg disabled:opacity-60">
                  Retry {s.retryable}
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

export function TestMessagePanel() {
  const [channel, setChannel] = useState<"EMAIL" | "SMS">("EMAIL");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<TestMessageResult | null>(null);
  const [pending, startTransition] = useTransition();

  function send(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => setResult(await sendTestMessage({ channel, to })));
  }

  return (
    <section className="rounded-md border border-border bg-bg-card p-5">
      <h2 className="m-0 text-heading font-medium text-text-primary">Send a test message</h2>
      <p className="mt-1 mb-4 text-caption text-text-muted">
        Sends one real message through the provider and shows exactly what came back. Failed messages don&apos;t record why they failed, so this is the quickest way to find out. Use your own email or phone. Limited to 10 an hour.
      </p>
      <form onSubmit={send} className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-[10px] text-text-muted">
          Channel
          <select
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value as "EMAIL" | "SMS");
              setResult(null);
            }}
            className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
          >
            <option value="EMAIL">Email</option>
            <option value="SMS">SMS</option>
          </select>
        </label>
        <label className="grid min-w-[240px] flex-1 gap-1 text-[10px] text-text-muted">
          {channel === "EMAIL" ? "Send to this email address" : "Send to this phone number"}
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
            placeholder={channel === "EMAIL" ? "you@example.com" : "+2348012345678"}
            inputMode={channel === "EMAIL" ? "email" : "tel"}
            className="h-10 rounded-md border border-border bg-bg-card px-3 text-body text-text-primary"
          />
        </label>
        <button type="submit" disabled={pending} className="h-10 rounded-md border border-primary bg-primary px-4 text-caption font-medium text-white disabled:opacity-60">
          {pending ? "Sending…" : "Send test"}
        </button>
      </form>

      {result?.ok && <p className="mt-4 mb-0 rounded-md bg-success-bg px-3 py-2 text-caption text-success">The provider accepted it. Check that it arrives; if it does, this channel is working.</p>}
      {result && !result.ok && (
        <div className="mt-4 rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-caption text-danger">
          <strong>Not sent.</strong> {result.hint && <span className="text-text-primary">{result.hint}</span>}
          <pre className="m-0 mt-2 whitespace-pre-wrap break-words font-mono text-[11px] text-danger">{result.error}</pre>
        </div>
      )}
    </section>
  );
}
