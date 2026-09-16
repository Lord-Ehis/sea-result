"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import { GradeBandsEditor } from "./GradeBandsEditor";
import type { GridConfig } from "./actions";

const rowInputClass = "h-[30px] min-w-0 rounded-md border border-border bg-bg-card px-2 text-[10px] text-text-primary";

function move<T>(list: T[], i: number, direction: -1 | 1): T[] {
  const j = i + direction;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

// Configures a "Grid" field — a subjects × score-columns table (e.g. a
// report card's Cognitive Domain section). Subjects and score columns are
// both admin-editable lists since schools vary in both (a class list of
// subjects, and how many CAs/exam components make up a term total).
export function GridFieldConfig({ grid, onChange }: { grid: GridConfig; onChange: (grid: GridConfig) => void }) {
  const distinctGrades = Array.from(new Set(grid.gradeBands.map((b) => b.label).filter((l) => l.trim() !== "")));

  return (
    <div className="grid gap-4 border-t border-border bg-bg-page px-3 py-3">
      <div className="grid gap-1.5">
        <span className="text-[10px] text-text-muted">Subjects</span>
        {grid.subjects.length === 0 && <p className="m-0 text-[10px] text-text-muted">No subjects yet.</p>}
        <div className="grid gap-1">
          {grid.subjects.map((s, i) => (
            <div key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-1.5">
              <input
                value={s.name}
                onChange={(e) => {
                  const subjects = [...grid.subjects];
                  subjects[i] = { ...s, name: e.target.value };
                  onChange({ ...grid, subjects });
                }}
                placeholder="Subject name"
                className={rowInputClass}
              />
              <span className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onChange({ ...grid, subjects: move(grid.subjects, i, -1) })}
                  disabled={i === 0}
                  aria-label={`Move ${s.name || "subject"} up`}
                  className="grid h-6 w-6 place-items-center rounded text-text-muted disabled:opacity-30"
                >
                  <ChevronUp size={14} strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...grid, subjects: move(grid.subjects, i, 1) })}
                  disabled={i === grid.subjects.length - 1}
                  aria-label={`Move ${s.name || "subject"} down`}
                  className="grid h-6 w-6 place-items-center rounded text-text-muted disabled:opacity-30"
                >
                  <ChevronDown size={14} strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...grid, subjects: grid.subjects.filter((x) => x.id !== s.id) })}
                  aria-label={`Remove ${s.name || "subject"}`}
                  className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-danger-bg hover:text-danger"
                >
                  <X size={14} strokeWidth={1.8} />
                </button>
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...grid, subjects: [...grid.subjects, { id: crypto.randomUUID(), name: "" }] })}
          className="h-7 w-fit rounded-md border border-dashed border-border px-2.5 text-[10px] font-medium text-primary hover:bg-primary-bg"
        >
          + Add subject
        </button>
      </div>

      <div className="grid gap-1.5">
        <span className="text-[10px] text-text-muted">Score columns (this term)</span>
        <div className="grid gap-1">
          {grid.rawColumns.map((c, i) => (
            <div key={c.id} className="grid grid-cols-[1fr_90px_auto] items-center gap-1.5">
              <input
                value={c.name}
                onChange={(e) => {
                  const rawColumns = [...grid.rawColumns];
                  rawColumns[i] = { ...c, name: e.target.value };
                  onChange({ ...grid, rawColumns });
                }}
                placeholder="Column name"
                className={rowInputClass}
              />
              <input
                type="number"
                value={c.maxMark}
                onChange={(e) => {
                  const rawColumns = [...grid.rawColumns];
                  rawColumns[i] = { ...c, maxMark: Number(e.target.value) };
                  onChange({ ...grid, rawColumns });
                }}
                placeholder="Max mark"
                className={rowInputClass}
              />
              <span className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onChange({ ...grid, rawColumns: move(grid.rawColumns, i, -1) })}
                  disabled={i === 0}
                  aria-label={`Move ${c.name || "column"} up`}
                  className="grid h-6 w-6 place-items-center rounded text-text-muted disabled:opacity-30"
                >
                  <ChevronUp size={14} strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...grid, rawColumns: move(grid.rawColumns, i, 1) })}
                  disabled={i === grid.rawColumns.length - 1}
                  aria-label={`Move ${c.name || "column"} down`}
                  className="grid h-6 w-6 place-items-center rounded text-text-muted disabled:opacity-30"
                >
                  <ChevronDown size={14} strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...grid, rawColumns: grid.rawColumns.filter((x) => x.id !== c.id) })}
                  aria-label={`Remove ${c.name || "column"}`}
                  className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-danger-bg hover:text-danger"
                >
                  <X size={14} strokeWidth={1.8} />
                </button>
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...grid, rawColumns: [...grid.rawColumns, { id: crypto.randomUUID(), name: "", maxMark: 100 }] })}
          className="h-7 w-fit rounded-md border border-dashed border-border px-2.5 text-[10px] font-medium text-primary hover:bg-primary-bg"
        >
          + Add score column
        </button>
        <p className="m-0 text-[10px] leading-relaxed text-text-muted">
          Term Total is the sum of these columns, per subject. Max mark is shown as a reference row only — it
          doesn&apos;t affect the calculation.
        </p>
      </div>

      <GradeBandsEditor bands={grid.gradeBands} onChange={(gradeBands) => onChange({ ...grid, gradeBands })} />

      <div className="grid gap-1.5">
        <span className="text-[10px] text-text-muted">Remarks per grade</span>
        {distinctGrades.length === 0 ? (
          <p className="m-0 text-[10px] text-text-muted">Add grade bands with labels first.</p>
        ) : (
          <div className="grid gap-1">
            {distinctGrades.map((grade) => (
              <div key={grade} className="grid grid-cols-[64px_1fr] items-center gap-1.5">
                <span className="text-[10px] font-medium text-text-secondary">{grade}</span>
                <input
                  value={grid.remarksMap.find((m) => m.grade === grade)?.remarks ?? ""}
                  onChange={(e) => {
                    const remarksMap = [...grid.remarksMap.filter((m) => m.grade !== grade), { grade, remarks: e.target.value }];
                    onChange({ ...grid, remarksMap });
                  }}
                  placeholder="e.g. Excellent"
                  className={rowInputClass}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-[10px] text-text-muted">
        <input type="checkbox" checked={grid.includeCumulative} disabled className="h-3.5 w-3.5 accent-primary" />
        Cumulative Result columns (coming in a future update)
      </label>
    </div>
  );
}
