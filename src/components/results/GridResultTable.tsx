import type { GridResultData } from "@/lib/grid-compute";

// Read-only subjects × columns table for lookup/parent dashboard — the
// published counterpart of GridEntryTable (which is editable).
export function GridResultTable({ grid }: { grid: GridResultData }) {
  return (
    <div className="grid gap-2">
      <strong className="text-body font-medium text-text-primary">{grid.fieldName}</strong>
      <div className="overflow-x-auto rounded-md border border-border bg-bg-card">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead className="bg-[#fafbfb]">
            <tr>
              <th className="border-b border-border px-3 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">Subject</th>
              {grid.columns.map((c) => (
                <th key={c.key} className="border-b border-border px-2 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.subjects.map((s) => (
              <tr key={s.id} className="border-b border-[#f0f2f3] last:border-0">
                <td className="px-3 py-2 text-caption font-medium text-text-primary">{s.name}</td>
                {grid.columns.map((c) => (
                  <td key={c.key} className="px-2 py-2 text-caption text-text-secondary">
                    {grid.cells[s.id]?.[c.key] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
