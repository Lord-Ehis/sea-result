"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Clock, CheckCircle2, XCircle } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { requestDeletion, cancelDeletionRequest } from "./actions";

type Request = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  requestedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  resolvedByName: string | null;
} | null;

export function DeletionRequestClient({
  studentCount,
  resultCount,
  request,
}: {
  studentCount: number;
  resultCount: number;
  request: Request;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await requestDeletion(reason);
        setReason("");
        setMessage("Deletion request submitted and is now awaiting Platform Owner review.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not submit this request.");
      }
    });
  }

  function handleCancel() {
    if (!request) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await cancelDeletionRequest(request.id);
        setMessage("Deletion request cancelled. Your school is active again.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not cancel this request.");
      }
    });
  }

  if (message) {
    return <p className="rounded-md bg-success-bg px-4 py-3 text-caption text-success">{message}</p>;
  }

  if (request?.status === "PENDING") {
    return (
      <section className="overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-warning-bg text-warning">
              <Clock size={17} strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="m-0 text-heading font-medium text-text-primary">Pending review</h2>
              <p className="mt-1 text-caption text-text-muted">Submitted {new Date(request.requestedAt).toLocaleDateString("en-GB")}</p>
            </div>
          </div>
          <StatusPill label="Pending" tone="warning" />
        </div>
        <div className="p-5">
          <p className="m-0 mb-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">Reason given</p>
          <p className="m-0 text-body leading-relaxed text-text-secondary">{request.reason}</p>
        </div>
        {error && <p className="mx-5 mb-4 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}
        <div className="flex justify-end border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="inline-flex h-9 items-center rounded-md border border-border bg-bg-card px-3.5 text-caption font-medium text-text-secondary disabled:opacity-60"
          >
            {pending ? "Cancelling…" : "Cancel request"}
          </button>
        </div>
      </section>
    );
  }

  if (request?.status === "APPROVED") {
    return (
      <section className="overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-5">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-danger-bg text-danger">
            <CheckCircle2 size={17} strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="m-0 text-heading font-medium text-text-primary">Deletion approved</h2>
            <p className="mt-1 text-caption text-text-muted">
              Approved {request.resolvedAt ? new Date(request.resolvedAt).toLocaleDateString("en-GB") : ""}
              {request.resolvedByName ? ` by ${request.resolvedByName}` : ""}
            </p>
          </div>
        </div>
        <div className="p-5 text-body text-text-secondary">
          This account is scheduled for removal. The platform team will follow up before anything is permanently deleted.
          {request.resolutionNote && (
            <p className="m-0 mt-3 rounded-md bg-bg-page px-3.5 py-3 text-caption text-text-secondary">{request.resolutionNote}</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <>
      {request?.status === "REJECTED" && (
        <section className="mb-5 overflow-hidden rounded-md border border-border bg-bg-card">
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-5">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-primary-bg text-primary">
              <XCircle size={17} strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="m-0 text-heading font-medium text-text-primary">Previous request declined</h2>
              <p className="mt-1 text-caption text-text-muted">
                {request.resolvedAt ? new Date(request.resolvedAt).toLocaleDateString("en-GB") : ""}
                {request.resolvedByName ? ` · by ${request.resolvedByName}` : ""}
              </p>
            </div>
          </div>
          {request.resolutionNote && <p className="m-0 px-5 py-4 text-body text-text-secondary">{request.resolutionNote}</p>}
        </section>
      )}

      <section className="overflow-hidden rounded-md border border-border bg-bg-card">
        <div className="flex items-start gap-3 border-b border-border bg-danger-bg/40 px-5 py-4">
          <AlertTriangle size={18} strokeWidth={1.8} className="mt-0.5 flex-none text-danger" />
          <p className="m-0 text-caption leading-relaxed text-danger">
            Submitting this request will mark your school as pending deletion — parent result lookup, new sign-ups, and your custom
            domain will stop working until it&apos;s resolved. This school has {studentCount.toLocaleString()} student
            {studentCount === 1 ? "" : "s"} and {resultCount.toLocaleString()} result{resultCount === 1 ? "" : "s"} on record.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-5">
          <label className="grid gap-1.5 text-caption font-medium text-text-secondary">
            Reason for deletion
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={10}
              rows={4}
              placeholder="Let the Platform Owner know why this school's account should be closed."
              className="rounded-md border border-border bg-bg-card px-3 py-2.5 text-body text-text-primary outline-none focus:border-primary"
            />
          </label>
          {error && <p className="mt-4 rounded-md bg-danger-bg px-3 py-2 text-caption text-danger">{error}</p>}
          <button
            type="submit"
            disabled={pending || reason.trim().length < 10}
            className="mt-4 inline-flex h-9 items-center rounded-md border border-danger bg-danger px-3.5 text-caption font-medium text-white disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Submit deletion request"}
          </button>
        </form>
      </section>
    </>
  );
}
