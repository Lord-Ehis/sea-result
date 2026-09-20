"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearTermException, markTermException, setPromotion } from "./actions";
import { termLabel } from "@/lib/term-number";
import type { TermState } from "@/lib/annual-summary";

type PromotionStatus = "PROMOTED" | "RETAINED" | "GRADUATED" | "PENDING" | "NOT_APPLICABLE";

export type AnnualReviewData = {
  weights: { 1: number; 2: number; 3: number };
  policy: "BLOCK" | "CALCULATE_AVAILABLE";
  issues: { studentId: string; student: string; message: string }[];
  students: {
    studentId: string;
    resultId: string;
    name: string;
    termStates: { t1: TermState; t2: TermState; t3: TermState };
    annualAverage: string | null;
    incomplete: boolean;
    promotionStatus: PromotionStatus | null;
    promotedToClassId: string | null;
  }[];
};

const PROMOTION_LABEL: Record<PromotionStatus, string> = {
  PROMOTED: "Promoted",
  RETAINED: "Retained (repeat class)",
  GRADUATED: "Graduated",
  PENDING: "Decision pending",
  NOT_APPLICABLE: "Not applicable",
};

const STATE_LABEL: Record<TermState, string> = {
  published: "Published",
  not_enrolled: "Not enrolled",
  exempt: "Exempt",
  missing: "No result",
};

const STATE_CLASS: Record<TermState, string> = {
  published: "bg-success-bg text-success",
  not_enrolled: "bg-bg-page text-text-secondary",
  exempt: "bg-bg-page text-text-secondary",
  missing: "bg-danger-bg text-danger",
};

const selectClass = "h-8 rounded-md border border-border bg-bg-card px-2 text-caption text-text-primary disabled:opacity-60";

// The 3rd Term review extras: which earlier terms each student has, the
// not-enrolled marks that resolve a missing one, and the promotion decision.
export function AnnualReviewPanel({
  batchId,
  status,
  annual,
  classes,
  onError,
}: {
  batchId: string;
  status: "SUBMITTED" | "APPROVED";
  annual: AnnualReviewData;
  classes: { id: string; name: string }[];
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [marking, setMarking] = useState<{ studentId: string; term: 1 | 2; status: "NOT_ENROLLED" | "EXEMPT"; reason: string } | null>(null);
  const [promotion, setPromotionState] = useState<Record<string, { status: PromotionStatus | ""; classId: string }>>(() =>
    Object.fromEntries(annual.students.map((s) => [s.resultId, { status: s.promotionStatus ?? "", classId: s.promotedToClassId ?? "" }])),
  );
  const canPromote = status === "SUBMITTED";

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) {
    onError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        onError(result.error);
        return;
      }
      after?.();
      router.refresh();
    });
  }

  function savePromotion(resultId: string, next: { status: PromotionStatus | ""; classId: string }) {
    setPromotionState((prev) => ({ ...prev, [resultId]: next }));
    if (!next.status) return;
    if (next.status === "PROMOTED" && !next.classId) return; // wait for the class
    run(() => setPromotion({ batchId, resultId, status: next.status as PromotionStatus, promotedToClassId: next.status === "PROMOTED" ? next.classId : null }));
  }

  return (
    <section className="mt-5 overflow-hidden rounded-md border border-border bg-bg-card">
      <div className="border-b border-border px-5 py-5">
        <h2 className="m-0 text-heading font-medium text-text-primary">Annual summary</h2>
        <p className="mt-1.5 text-caption text-text-muted">
          Weights: {termLabel(1)} {annual.weights[1]}% · {termLabel(2)} {annual.weights[2]}% · {termLabel(3)} {annual.weights[3]}%.{" "}
          {annual.policy === "BLOCK"
            ? "A student with no earlier-term result is held until it's published or they're marked not enrolled."
            : "A student with no earlier-term result is calculated from the terms available and labelled incomplete."}
        </p>
      </div>

      {annual.issues.length > 0 && (
        <div className="border-b border-border bg-danger-bg px-5 py-3">
          <p className="m-0 mb-1 text-caption font-medium text-danger">
            {status === "APPROVED" ? "Can't publish yet" : "Can't approve yet"} — {annual.issues.length} thing(s) to sort out:
          </p>
          <ul className="m-0 list-disc pl-5 text-caption text-danger">
            {annual.issues.slice(0, 8).map((issue, i) => (
              <li key={i}>
                {issue.student} — {issue.message}
              </li>
            ))}
            {annual.issues.length > 8 && <li>…and {annual.issues.length - 8} more</li>}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead className="bg-[#fafbfb]">
            <tr>
              {["Student", termLabel(1), termLabel(2), "Annual average", "Promotion"].map((h) => (
                <th key={h} className="border-b border-border px-4 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {annual.students.map((s) => {
              const p = promotion[s.resultId] ?? { status: "", classId: "" };
              return (
                <tr key={s.resultId} className="border-b border-[#f0f2f3] align-top last:border-0">
                  <td className="px-4 py-3 text-caption font-medium text-text-primary">{s.name}</td>
                  {([1, 2] as const).map((t) => {
                    const state = s.termStates[`t${t}`];
                    const isMarking = marking?.studentId === s.studentId && marking.term === t;
                    return (
                      <td key={t} className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${STATE_CLASS[state]}`}>{STATE_LABEL[state]}</span>
                        {(state === "not_enrolled" || state === "exempt") && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => run(() => clearTermException({ batchId, studentId: s.studentId, termNumber: t }))}
                            className="ml-2 text-[10px] text-primary underline disabled:opacity-50"
                          >
                            Undo
                          </button>
                        )}
                        {state === "missing" && !isMarking && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setMarking({ studentId: s.studentId, term: t, status: "NOT_ENROLLED", reason: "" })}
                            className="ml-2 text-[10px] text-primary underline disabled:opacity-50"
                          >
                            Mark not enrolled…
                          </button>
                        )}
                        {isMarking && marking && (
                          <div className="mt-2 grid gap-1.5">
                            <select
                              value={marking.status}
                              onChange={(e) => setMarking({ ...marking, status: e.target.value as "NOT_ENROLLED" | "EXEMPT" })}
                              className={selectClass}
                              aria-label="Reason type"
                            >
                              <option value="NOT_ENROLLED">Not enrolled that term</option>
                              <option value="EXEMPT">Exempt that term</option>
                            </select>
                            <input
                              value={marking.reason}
                              onChange={(e) => setMarking({ ...marking, reason: e.target.value })}
                              placeholder="Reason (kept in the audit trail)"
                              className="h-8 rounded-md border border-border bg-bg-card px-2 text-caption text-text-primary"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={pending || !marking.reason.trim()}
                                onClick={() =>
                                  run(
                                    () => markTermException({ batchId, studentId: s.studentId, termNumber: t, status: marking.status, reason: marking.reason }),
                                    () => setMarking(null),
                                  )
                                }
                                className="h-7 rounded-md border border-primary bg-primary px-2.5 text-[10px] font-medium text-white disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button type="button" onClick={() => setMarking(null)} className="h-7 rounded-md border border-border px-2.5 text-[10px] text-text-secondary">
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-caption text-text-primary">
                    {s.annualAverage === null ? "—" : Number(s.annualAverage).toFixed(2)}
                    {s.incomplete && <span className="ml-1.5 rounded-full bg-warning-bg px-2 py-0.5 text-[10px] text-warning">incomplete</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={p.status}
                        disabled={!canPromote || pending}
                        onChange={(e) => savePromotion(s.resultId, { status: e.target.value as PromotionStatus | "", classId: p.classId })}
                        className={selectClass}
                        aria-label={`Promotion decision for ${s.name}`}
                      >
                        <option value="">Choose…</option>
                        {(Object.keys(PROMOTION_LABEL) as PromotionStatus[]).map((k) => (
                          <option key={k} value={k}>
                            {PROMOTION_LABEL[k]}
                          </option>
                        ))}
                      </select>
                      {p.status === "PROMOTED" && (
                        <select
                          value={p.classId}
                          disabled={!canPromote || pending}
                          onChange={(e) => savePromotion(s.resultId, { status: "PROMOTED", classId: e.target.value })}
                          className={selectClass}
                          aria-label={`Class ${s.name} is promoted to`}
                        >
                          <option value="">Promoted to…</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!canPromote && <p className="m-0 border-t border-border px-5 py-2.5 text-caption text-text-muted">Approved — promotion decisions are locked. Send the batch back to change them.</p>}
    </section>
  );
}
