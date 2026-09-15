"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Clock, CheckCircle2, XCircle } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { resolveDeletionRequest } from "../actions";

type Request = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  requestedAt: string;
  requestedByName: string;
  requestedByEmail: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  resolvedByName: string | null;
};

export function DeletionRequestPanel({ request }: { request: Request }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleResolve(decision: "APPROVED" | "REJECTED") {
    setError(null);
    startTransition(async () => {
      try {
        await resolveDeletionRequest(request.id, decision, note);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not resolve this request.");
      }
    });
  }

  if (request.status === "PENDING") {
    return (
      <section className="mb-7 overflow-hidden rounded-md border border-warning/30 bg-bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-warning-bg/50 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={17} strokeWidth={1.8} className="text-warning" />
            <h2 className="m-0 text-heading font-medium text-text-primary">Deletion request awaiting review</h2>
          </div>
          <StatusPill label="Pending" tone="warning" />
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <div>
            <p className="m-0 mb-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">Requested by</p>
            <p className="m-0 text-body text-text-secondary">
              {request.requestedByName} · {request.requestedByEmail}
            </p>
            <p className="mt-3 mb-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">Submitted</p>
            <p className="m-0 text-body text-text-secondary">{new Date(request.requestedAt).toLocaleDateString("en-GB")}</p>
          </div>
          <div>
            <p className="m-0 mb-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">Reason given</p>
            <p className="m-0 text-body leading-relaxed text-text-secondary">{request.reason}</p>
          </div>
        </div>
        <div className="border-t border-border p-5">
          <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
            Note <span className="font-normal text-text-muted">(required if declining)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Visible to the school admin."
              className="rounded-md border border-border bg-bg-card px-3 py-2 text-body text-text-primary outline-none focus:border-primary"
            />
          </label>
          {error && <p className="mt-3 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => handleResolve("REJECTED")}
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary disabled:opacity-60"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => handleResolve("APPROVED")}
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md border border-danger bg-danger px-3.5 text-caption font-medium text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : "Approve deletion"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  const resolved = {
    APPROVED: { icon: CheckCircle2, label: "Deletion approved", tone: "text-danger bg-danger-bg" },
    REJECTED: { icon: XCircle, label: "Deletion declined", tone: "text-primary bg-primary-bg" },
  }[request.status];
  const Icon = resolved.icon;

  return (
    <section className="mb-7 overflow-hidden rounded-md border border-border bg-bg-card">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <span className={`grid h-9 w-9 place-items-center rounded-md ${resolved.tone}`}>
          <Icon size={17} strokeWidth={1.8} />
        </span>
        <div>
          <h2 className="m-0 text-heading font-medium text-text-primary">{resolved.label}</h2>
          <p className="mt-1 text-caption text-text-muted">
            {request.resolvedAt ? new Date(request.resolvedAt).toLocaleDateString("en-GB") : ""}
            {request.resolvedByName ? ` · by ${request.resolvedByName}` : ""}
          </p>
        </div>
      </div>
      <div className="p-5">
        <p className="m-0 mb-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">Original reason</p>
        <p className="m-0 mb-3 text-body text-text-secondary">{request.reason}</p>
        {request.resolutionNote && (
          <>
            <p className="m-0 mb-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">Resolution note</p>
            <p className="m-0 text-body text-text-secondary">{request.resolutionNote}</p>
          </>
        )}
        {request.status === "APPROVED" && (
          <p className="mt-3 flex items-center gap-1.5 text-caption text-text-muted">
            <Clock size={13} strokeWidth={1.8} />
            Data removal is a manual follow-up step, not automatic.
          </p>
        )}
      </div>
    </section>
  );
}
