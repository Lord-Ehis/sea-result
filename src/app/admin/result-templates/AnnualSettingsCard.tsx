"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { saveAnnualSettings } from "./annual-actions";
import { TERM_NUMBERS, termLabel } from "@/lib/term-number";
import { weightsAreValid, type AnnualPolicy, type AnnualSettings } from "@/lib/annual-summary";

const inputClass = "h-[34px] w-full rounded-md border border-border bg-bg-card px-2.5 text-caption text-text-primary";

// School-wide rules for the 3rd Term annual summary (spec §6): how much each
// term counts for, what happens when a student has no result for an earlier
// term, and whether a class position for the year is shown.
export function AnnualSettingsCard({ initial }: { initial: AnnualSettings }) {
  const [weights, setWeights] = useState<Record<number, string>>({
    1: String(initial.weights[1]),
    2: String(initial.weights[2]),
    3: String(initial.weights[3]),
  });
  const [policy, setPolicy] = useState<AnnualPolicy>(initial.policy);
  const [showPosition, setShowPosition] = useState(initial.showPosition);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const numeric = { 1: Number(weights[1]), 2: Number(weights[2]), 3: Number(weights[3]) };
  const total = numeric[1] + numeric[2] + numeric[3];
  const totalOk = weightsAreValid(numeric);

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveAnnualSettings({
        term1Weight: numeric[1],
        term2Weight: numeric[2],
        term3Weight: numeric[3],
        incompleteYearPolicy: policy,
        showAnnualPosition: showPosition,
      });
      setMessage(result.ok ? { ok: true, text: "Annual summary settings saved." } : { ok: false, text: result.error });
    });
  }

  return (
    <section className="mb-4 rounded-md border border-border bg-bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
        <div>
          <h2 className="m-0 text-body font-medium text-text-primary">Annual summary</h2>
          <p className="mt-1 text-caption text-text-muted">
            How the year is worked out on 3rd Term results. Results already published keep the weights they were published with.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending || !totalOk}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-caption font-medium text-text-secondary disabled:opacity-60"
        >
          <Check size={14} strokeWidth={1.8} />
          Save settings
        </button>
      </div>

      <div className="grid gap-5 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <span className="text-[10px] text-text-muted">Term weights (%)</span>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {TERM_NUMBERS.map((n) => (
              <label key={n} className="grid gap-1 text-[10px] text-text-muted">
                {termLabel(n)}
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={weights[n]}
                  onChange={(e) => setWeights((w) => ({ ...w, [n]: e.target.value }))}
                  className={inputClass}
                />
              </label>
            ))}
          </div>
          <p className={`mt-1.5 text-caption ${totalOk ? "text-text-muted" : "text-danger"}`}>
            Total {Math.round(total * 100) / 100}%{totalOk ? "" : " — must be exactly 100% before a 3rd Term can be submitted."}
          </p>
        </div>

        <div className="grid gap-2">
          <span className="text-[10px] text-text-muted">When a student has no result for an earlier term</span>
          <label className="flex items-start gap-2 text-caption text-text-secondary">
            <input type="radio" name="annual-policy" checked={policy === "BLOCK"} onChange={() => setPolicy("BLOCK")} className="mt-0.5" />
            <span>
              <strong className="font-medium text-text-primary">Hold until it&apos;s sorted out</strong> — the 3rd Term can&apos;t be approved until the result is
              published or the student is marked not enrolled for that term.
            </span>
          </label>
          <label className="flex items-start gap-2 text-caption text-text-secondary">
            <input
              type="radio"
              name="annual-policy"
              checked={policy === "CALCULATE_AVAILABLE"}
              onChange={() => setPolicy("CALCULATE_AVAILABLE")}
              className="mt-0.5"
            />
            <span>
              <strong className="font-medium text-text-primary">Calculate from the terms available</strong> — the annual result is labelled as incomplete.
            </span>
          </label>
          <label className="mt-1 flex items-center gap-2 text-caption text-text-secondary">
            <input type="checkbox" checked={showPosition} onChange={(e) => setShowPosition(e.target.checked)} />
            Show each student&apos;s position in class for the year
          </label>
        </div>
      </div>

      {message && (
        <p className={`m-0 border-t border-border px-5 py-2.5 text-caption ${message.ok ? "text-success" : "text-danger"}`}>{message.text}</p>
      )}
    </section>
  );
}
