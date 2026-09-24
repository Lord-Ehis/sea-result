import type { PerformanceSummary } from "@/lib/grid-compute";

// Overall performance across all subjects: total obtained / obtainable,
// percentage, and the grade + remark that percentage earns.
export function PerformanceSummaryBox({ summary }: { summary: PerformanceSummary }) {
  const items = [
    { label: "Total obtained", value: String(summary.totalObtained) },
    { label: "Total obtainable", value: String(summary.totalObtainable) },
    { label: "Percentage", value: `${summary.percentage}%` },
    { label: "Grade", value: summary.grade ? (summary.remark ? `${summary.grade} · ${summary.remark}` : summary.grade) : "—" },
  ];
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="border-b border-border bg-bg-page px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-text-muted">
        Performance summary
      </div>
      <dl className="grid grid-cols-2 gap-3 p-3 text-caption sm:grid-cols-4">
        {items.map((i) => (
          <div key={i.label}>
            <dt className="text-[10px] text-text-muted">{i.label}</dt>
            <dd className="font-medium">{i.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
