import type { GradingScaleLegendEntry } from "@/lib/grid-compute";

// The "Grade Scale" legend (e.g. "70–100 = A = Excellent"), highest band first.
export function GradingScaleTable({ bands }: { bands: GradingScaleLegendEntry[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="border-b border-border bg-bg-page px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-text-muted">
        Grade scale
      </div>
      <table className="w-full border-collapse text-left text-caption">
        <tbody>
          {bands.map((b) => (
            <tr key={b.gradeCode} className="border-b border-border last:border-0">
              <td className="px-3 py-1.5 font-medium">
                {b.minScore}–{b.maxScore}%
              </td>
              <td className="px-3 py-1.5 font-medium">{b.gradeCode}</td>
              <td className="px-3 py-1.5 text-text-secondary">{b.remark}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
