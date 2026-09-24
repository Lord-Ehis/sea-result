import type { GradeAnalysis } from "@/lib/grid-compute";

// Class-wide: how many students earned each overall grade, and how many
// subjects the class offered.
export function GradeAnalysisTable({ analysis }: { analysis: GradeAnalysis }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="border-b border-border bg-bg-page px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-text-muted">Grade analysis</div>
      <div className="overflow-x-auto">
        <table className="w-full text-center text-caption">
          <thead>
            <tr className="border-b border-border text-[10px] text-text-muted">
              {analysis.counts.map((c) => (
                <th key={c.grade} className="px-3 py-1.5 font-medium">
                  {c.grade}
                </th>
              ))}
              <th className="px-3 py-1.5 font-medium">Students</th>
              <th className="px-3 py-1.5 font-medium">Subjects offered</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {analysis.counts.map((c) => (
                <td key={c.grade} className="px-3 py-1.5 font-medium">
                  {c.count}
                </td>
              ))}
              <td className="px-3 py-1.5 font-medium">{analysis.totalStudents}</td>
              <td className="px-3 py-1.5 font-medium">{analysis.totalSubjects}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
