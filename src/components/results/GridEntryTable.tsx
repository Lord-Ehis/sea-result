"use client";

import type { TemplateField } from "@/app/admin/result-templates/actions";
import { gridKey } from "@/lib/grid-compute";

// Shared editable subjects × columns table for a "Grid" field — used by
// both teacher entry (editable) and admin review (editable-until-publish),
// always scoped to one student at a time (a grid can easily run to a dozen
// columns, so unlike ordinary fields it can't also be a table column).
export function GridEntryTable({
  field,
  data,
  computed,
  onChange,
  locked,
  blankKeys,
}: {
  field: TemplateField;
  data: Record<string, string>;
  computed: Record<string, string>;
  onChange: (key: string, value: string) => void;
  locked: boolean;
  // Optional — highlights specific raw cells as still-blank (used by admin
  // review; teacher entry relies on the overall progress bar instead).
  blankKeys?: Set<string>;
}) {
  const grid = field.grid;
  if (!grid) return null;

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-left" style={{ minWidth: 350 + grid.rawColumns.length * 90 }}>
        <thead className="bg-[#fafbfb]">
          <tr>
            <th className="border-b border-border px-3 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Subject
            </th>
            {grid.rawColumns.map((c) => (
              <th key={c.id} className="border-b border-border px-2 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                {c.name}
                <span className="mt-0.5 block font-normal normal-case text-[9px] text-text-muted">/ {c.maxMark}</span>
              </th>
            ))}
            <th className="border-b border-border px-2 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">Total</th>
            <th className="border-b border-border px-2 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">Grade</th>
            <th className="border-b border-border px-2 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">Position</th>
            <th className="border-b border-border px-2 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {grid.subjects.length === 0 && (
            <tr>
              <td colSpan={grid.rawColumns.length + 5} className="px-3 py-5 text-center text-caption text-text-muted">
                No subjects configured on this template yet.
              </td>
            </tr>
          )}
          {grid.subjects.map((s) => {
            const totalKey = gridKey(field.id, s.id, "termTotal");
            const gradeKey = gridKey(field.id, s.id, "grade");
            const remarksKey = gridKey(field.id, s.id, "remarks");
            return (
              <tr key={s.id} className="border-b border-[#f0f2f3] last:border-0">
                <td className="px-3 py-2 text-caption font-medium text-text-primary">{s.name || "Untitled subject"}</td>
                {grid.rawColumns.map((c) => {
                  const key = gridKey(field.id, s.id, c.id);
                  const blank = blankKeys?.has(key) ?? false;
                  return (
                    <td key={c.id} className="px-2 py-2">
                      <input
                        type="number"
                        value={data[key] ?? ""}
                        onChange={(e) => onChange(key, e.target.value)}
                        disabled={locked}
                        className={`h-[34px] w-full min-w-[68px] rounded-md border px-2 text-caption text-text-primary disabled:bg-bg-page disabled:text-text-muted ${
                          blank ? "border-warning/50 bg-warning-bg" : "border-border bg-bg-card"
                        }`}
                      />
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-caption font-medium text-text-secondary">{computed[totalKey] || "—"}</td>
                <td className="px-2 py-2 text-caption font-medium text-text-secondary">{computed[gradeKey] || "—"}</td>
                <td className="px-2 py-2 text-caption text-text-secondary">
                  {/* Batch-wide, like the flat "position" formula — only ever known at publish time. */}
                  <span className="italic text-text-muted">At publish</span>
                </td>
                <td className="px-2 py-2 text-caption text-text-secondary">{computed[remarksKey] || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
