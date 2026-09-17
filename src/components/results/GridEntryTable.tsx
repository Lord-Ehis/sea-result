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

  // Subject + rawColumns + Total/Grade/Position/Remarks + (when on) 8 Cumulative Result columns.
  const colSpan = 1 + grid.rawColumns.length + 4 + (grid.includeCumulative ? 8 : 0);

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-left" style={{ minWidth: 350 + grid.rawColumns.length * 90 + (grid.includeCumulative ? 630 : 0) }}>
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
            {grid.includeCumulative && (
              <>
                <th className="border-b border-border px-2 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">First Term</th>
                <th className="border-b border-border px-2 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">Second Term</th>
                <th className="border-b border-border px-2 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">Third Term</th>
                <th className="border-b border-border px-2 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">Cumulative Total</th>
                <th className="border-b border-border px-2 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">Cumulative Avg</th>
                <th className="border-b border-border px-2 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">Cumulative Grade</th>
                <th className="border-b border-border px-2 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">Cumulative Position</th>
                <th className="border-b border-border px-2 py-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">Cumulative Remarks</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {grid.subjects.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="px-3 py-5 text-center text-caption text-text-muted">
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
                <AtPublishCell />
                <td className="px-2 py-2 text-caption text-text-secondary">{computed[remarksKey] || "—"}</td>
                {grid.includeCumulative && (
                  <>
                    {/* First/Second/Third Term and every Cumulative* column are all only
                        known once this batch is actually published (see publishBatch /
                        fillGridCumulativeTermSlots) — never live during entry/review. */}
                    <AtPublishCell />
                    <AtPublishCell />
                    <AtPublishCell />
                    <AtPublishCell />
                    <AtPublishCell />
                    <AtPublishCell />
                    <AtPublishCell />
                    <AtPublishCell />
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AtPublishCell() {
  return (
    <td className="px-2 py-2 text-caption text-text-secondary">
      <span className="italic text-text-muted">At publish</span>
    </td>
  );
}
