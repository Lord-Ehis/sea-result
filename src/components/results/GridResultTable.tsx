import type { GridResultData } from "@/lib/grid-compute";

// Read-only subjects × columns table for lookup/parent dashboard — the
// published counterpart of GridEntryTable (which is editable).
export function GridResultTable({ grid }: { grid: GridResultData }) {
  return (
    <div className="grid gap-2">
      <strong className="text-body font-medium text-text-primary">{grid.fieldName}</strong>
      <div className="hidden overflow-x-auto rounded-md border border-border bg-bg-card lg:block">
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

      <div className="grid gap-3 lg:hidden">
        {grid.subjects.map((s) => (
          <div key={s.id} className="rounded-md border border-border bg-bg-card p-4">
            <strong className="block text-body font-medium text-text-primary">{s.name}</strong>
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-[#f0f2f3] pt-3 text-caption">
              {grid.columns.map((c) => (
                <div key={c.key}>
                  <dt className="text-[10px] text-text-muted">{c.label}</dt>
                  <dd className="font-medium text-text-secondary">{grid.cells[s.id]?.[c.key] || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
