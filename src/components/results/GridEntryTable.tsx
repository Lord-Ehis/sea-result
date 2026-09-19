"use client";

import type { TemplateField } from "@/app/admin/result-templates/actions";
import { gridKey } from "@/lib/grid-compute";
import { EXPLICIT_SCORE_STATES, SCORE_STATE_LABEL, explicitScoreState, formatScore, scoreStateKey } from "@/lib/score-state";

// One score input plus a compact status picker (— / ABS / EXM / N/A). A
// non-scored status disables the number box, since its value is ignored, and
// a number outside 0…max is flagged the moment it's typed.
function ScoreCell({
  cellKey,
  max,
  data,
  onChange,
  locked,
  blank,
}: {
  cellKey: string;
  max: number;
  data: Record<string, string>;
  onChange: (key: string, value: string) => void;
  locked: boolean;
  blank: boolean;
}) {
  const state = explicitScoreState(data, cellKey);
  const value = data[cellKey] ?? "";
  const n = Number(value);
  // A locked sheet is history, not something to fix: older data can predate
  // maximum enforcement, so only flag cells someone can still change.
  const invalid = !locked && !state && value.trim() !== "" && (!Number.isFinite(n) || n < 0 || n > max);

  return (
    <div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={max}
          step="any"
          value={state ? "" : value}
          placeholder={state ? SCORE_STATE_LABEL[state] : undefined}
          onChange={(e) => onChange(cellKey, e.target.value)}
          disabled={locked || !!state}
          aria-invalid={invalid}
          className={`h-[34px] w-full min-w-[60px] rounded-md border px-2 text-caption text-text-primary placeholder:font-medium placeholder:text-text-secondary disabled:bg-bg-page disabled:text-text-muted ${
            invalid ? "border-danger bg-danger-bg" : blank ? "border-warning/50 bg-warning-bg" : "border-border bg-bg-card"
          }`}
        />
        <select
          aria-label="Score status"
          value={state ?? ""}
          onChange={(e) => onChange(scoreStateKey(cellKey), e.target.value)}
          disabled={locked}
          className="h-[34px] w-[58px] flex-none rounded-md border border-border bg-bg-card px-1 text-[10px] text-text-secondary disabled:bg-bg-page disabled:text-text-muted"
        >
          <option value="">—</option>
          {EXPLICIT_SCORE_STATES.map((s) => (
            <option key={s} value={s}>
              {SCORE_STATE_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      {invalid && <span className="mt-0.5 block text-[9px] text-danger">Must be 0 to {max}</span>}
    </div>
  );
}

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
    <>
    <div className="hidden overflow-x-auto rounded-md border border-border lg:block">
      <table className="w-full border-collapse text-left" style={{ minWidth: 350 + grid.rawColumns.length * 140 + (grid.includeCumulative ? 630 : 0) }}>
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
                  return (
                    <td key={c.id} className="px-2 py-2">
                      <ScoreCell
                        cellKey={key}
                        max={c.maxMark}
                        data={data}
                        onChange={onChange}
                        locked={locked}
                        blank={(blankKeys?.has(key) ?? false) && !explicitScoreState(data, key)}
                      />
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-caption font-medium text-text-secondary">{formatScore(computed[totalKey]) || "—"}</td>
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

    <div className="grid gap-3 p-4 lg:hidden">
      {grid.subjects.length === 0 && (
        <div className="rounded-md border border-border px-5 py-10 text-center text-body text-text-muted">
          No subjects configured on this template yet.
        </div>
      )}
      {grid.subjects.map((s) => {
        const totalKey = gridKey(field.id, s.id, "termTotal");
        const gradeKey = gridKey(field.id, s.id, "grade");
        const remarksKey = gridKey(field.id, s.id, "remarks");
        return (
          <div key={s.id} className="rounded-md border border-border bg-bg-card p-4">
            <strong className="block text-body font-medium text-text-primary">{s.name || "Untitled subject"}</strong>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#f0f2f3] pt-3">
              {grid.rawColumns.map((c) => {
                const key = gridKey(field.id, s.id, c.id);
                return (
                  <div key={c.id} className="grid gap-1 text-[10px] text-text-muted">
                    <span>
                      {c.name} / {c.maxMark}
                    </span>
                    <ScoreCell
                      cellKey={key}
                      max={c.maxMark}
                      data={data}
                      onChange={onChange}
                      locked={locked}
                      blank={(blankKeys?.has(key) ?? false) && !explicitScoreState(data, key)}
                    />
                  </div>
                );
              })}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-[#f0f2f3] pt-3 text-caption">
              <div>
                <dt className="text-[10px] text-text-muted">Total</dt>
                <dd className="font-medium text-text-secondary">{formatScore(computed[totalKey]) || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-text-muted">Grade</dt>
                <dd className="font-medium text-text-secondary">{computed[gradeKey] || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-text-muted">Position</dt>
                <dd className="italic text-text-muted">At publish</dd>
              </div>
              <div>
                <dt className="text-[10px] text-text-muted">Remarks</dt>
                <dd className="text-text-secondary">{computed[remarksKey] || "—"}</dd>
              </div>
            </dl>
            {grid.includeCumulative && (
              <div className="mt-3 rounded-md border border-dashed border-border bg-bg-page p-3">
                <span className="text-[10px] text-text-muted">Cumulative (at publish)</span>
                <dl className="mt-1.5 grid grid-cols-2 gap-2 text-[10px]">
                  {[
                    "First Term",
                    "Second Term",
                    "Third Term",
                    "Cumulative Total",
                    "Cumulative Avg",
                    "Cumulative Grade",
                    "Cumulative Position",
                    "Cumulative Remarks",
                  ].map((label) => (
                    <div key={label}>
                      <dt className="text-text-muted">{label}</dt>
                      <dd className="italic text-text-muted">At publish</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        );
      })}
    </div>
    </>
  );
}

function AtPublishCell() {
  return (
    <td className="px-2 py-2 text-caption text-text-secondary">
      <span className="italic text-text-muted">At publish</span>
    </td>
  );
}
