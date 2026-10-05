import type { GridResultData } from "@/lib/grid-compute";

// Read-only subjects × columns table for lookup/parent dashboard — the
// published counterpart of GridEntryTable (which is editable).
//
// `compact` is the printed report-card form: always a dense table (never the
// stacked phone cards), so it fits beside the other report-card blocks.
export function GridResultTable({ grid, compact = false }: { grid: GridResultData; compact?: boolean }) {
  const th = compact ? "border-b border-border px-1.5 py-1 text-[9px] font-medium uppercase tracking-wide text-text-muted" : "border-b border-border px-2 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted";
  const td = compact ? "px-1.5 py-0.5 text-[10px] text-text-secondary" : "px-2 py-2 text-caption text-text-secondary";
  return (
    <div className="grid gap-2">
      {!compact && <strong className="text-body font-medium text-text-primary">{grid.fieldName}</strong>}
      <div className={`overflow-x-auto rounded-md border border-border bg-bg-card ${compact ? "" : "hidden lg:block"}`}>
        <table className={`w-full border-collapse text-left ${compact ? "" : "min-w-[520px]"}`}>
          <thead className="bg-[#fafbfb]">
            <tr>
              <th className={`${th} ${compact ? "" : "px-3"}`}>Subject</th>
              {grid.columns.map((c) => (
                <th key={c.key} className={th}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.subjects.map((s) => (
              <tr key={s.id} className="border-b border-[#f0f2f3] last:border-0">
                <td className={`font-medium text-text-primary ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-3 py-2 text-caption"}`}>{s.name}</td>
                {grid.columns.map((c) => (
                  <td key={c.key} className={td}>
                    {grid.cells[s.id]?.[c.key] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!compact && (
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
      )}
    </div>
  );
}
