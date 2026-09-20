import type { AnnualSummaryPayload } from "@/lib/annual-summary";
import { termLabel } from "@/lib/term-number";

const PROMOTION_LABEL: Record<string, string> = {
  PROMOTED: "Promoted",
  RETAINED: "Retained (repeat class)",
  GRADUATED: "Graduated",
  PENDING: "Decision pending",
  NOT_APPLICABLE: "—",
};

// The published year at a glance: each subject's three term totals, its
// weighted annual average and grade, then the overall result and promotion
// decision. Read-only and driven entirely by the frozen snapshot — the weights
// and terms it shows are the ones it was computed with. Shared by the print
// page, the parent dashboard and the public lookup.
export function AnnualSummaryTable({ annual }: { annual: AnnualSummaryPayload }) {
  const show = (v: string | null) => (v === null ? "—" : Number(v).toFixed(2));
  const termHeads = [termLabel(1), termLabel(2), termLabel(3)];

  return (
    <div className="grid gap-2">
      <strong className="text-body font-medium text-text-primary">Annual summary</strong>
      <p className="m-0 text-caption text-text-muted">
        Weighted average across the year: {termLabel(1)} {annual.weights.t1}% · {termLabel(2)} {annual.weights.t2}% · {termLabel(3)} {annual.weights.t3}%.
        A term a student wasn&apos;t enrolled for is left out, not counted as zero.
      </p>
      {annual.incomplete ? (
        <p className="m-0 rounded-md bg-warning-bg px-3 py-2 text-caption text-warning">
          Incomplete year — {annual.note ?? "calculated from the terms available"}.
        </p>
      ) : (
        annual.note && <p className="m-0 text-caption text-text-secondary">{annual.note}.</p>
      )}

      <div className="hidden overflow-x-auto rounded-md border border-border bg-bg-card lg:block">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead className="bg-[#fafbfb]">
            <tr>
              {["Subject", ...termHeads, "Annual average", "Grade", "Remarks"].map((h) => (
                <th key={h} className="border-b border-border px-3 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {annual.subjects.map((s) => (
              <tr key={s.subjectId} className="border-b border-[#f0f2f3] last:border-0">
                <td className="px-3 py-2 text-caption font-medium text-text-primary">{s.name}</td>
                <td className="px-3 py-2 text-caption text-text-secondary">{show(s.t1)}</td>
                <td className="px-3 py-2 text-caption text-text-secondary">{show(s.t2)}</td>
                <td className="px-3 py-2 text-caption text-text-secondary">{show(s.t3)}</td>
                <td className="px-3 py-2 text-caption font-medium text-text-primary">{show(s.average)}</td>
                <td className="px-3 py-2 text-caption font-medium text-text-primary">{s.grade || "—"}</td>
                <td className="px-3 py-2 text-caption text-text-secondary">{s.remarks || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {annual.subjects.map((s) => (
          <div key={s.subjectId} className="rounded-md border border-border bg-bg-card p-4">
            <strong className="block text-body font-medium text-text-primary">{s.name}</strong>
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-[#f0f2f3] pt-3 text-caption">
              {[
                [termHeads[0], show(s.t1)],
                [termHeads[1], show(s.t2)],
                [termHeads[2], show(s.t3)],
                ["Annual average", show(s.average)],
                ["Grade", s.grade || "—"],
                ["Remarks", s.remarks || "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[10px] text-text-muted">{label}</dt>
                  <dd className="font-medium text-text-secondary">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-md bg-bg-page p-3 text-caption sm:grid-cols-4">
        <div>
          <dt className="text-[10px] text-text-muted">Overall annual average</dt>
          <dd className="font-medium">{show(annual.overall.average)}</dd>
        </div>
        <div>
          <dt className="text-[10px] text-text-muted">Overall grade</dt>
          <dd className="font-medium">{annual.overall.grade || "—"}</dd>
        </div>
        {annual.position && (
          <div>
            <dt className="text-[10px] text-text-muted">Position for the year</dt>
            <dd className="font-medium">{annual.position}</dd>
          </div>
        )}
        {annual.promotion && (
          <div>
            <dt className="text-[10px] text-text-muted">Promotion</dt>
            <dd className="font-medium">
              {PROMOTION_LABEL[annual.promotion.status] ?? annual.promotion.status}
              {annual.promotion.status === "PROMOTED" && annual.promotion.promotedToClass ? ` to ${annual.promotion.promotedToClass}` : ""}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
