"use client";

import type { TemplateField } from "@/app/admin/result-templates/actions";
import { explicitScoreState } from "@/lib/score-state";
import { computedAtPublish } from "@/lib/result-field-display";
import { DROPDOWN_OPTIONS, ratingOptionsFor } from "@/lib/field-options";

// Shared by both the grid-mode per-student panel and the plain flat-field
// table below — type-aware editing for a single non-Grid field (Dropdown/
// Rating scale get a real <select> with save-on-choose, matching entry's
// UX; previously every non-Computed field fell through to a plain text
// input regardless of type).
export function FlatFieldEditor({
  field,
  value,
  blank,
  onChange,
  onBlur,
}: {
  field: TemplateField;
  value: string;
  blank: boolean;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
}) {
  if (field.type === "Computed") {
    return (
      <div className="flex min-h-[34px] w-full min-w-[110px] items-center whitespace-pre-line rounded-md border border-dashed border-border bg-bg-page px-2 py-2 text-caption text-text-secondary">
        {computedAtPublish(field) ? <span className="italic text-text-muted">At publish</span> : value || "—"}
      </div>
    );
  }

  const borderClass = blank ? "border-warning/50 bg-warning-bg" : "border-border bg-bg-card";
  const selectClass = `h-[34px] w-full min-w-[110px] rounded-md border px-2 text-caption text-text-primary ${borderClass}`;

  if (field.type === "Dropdown") {
    return (
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onBlur(e.target.value);
        }}
        className={selectClass}
      >
        <option value="">Select…</option>
        {DROPDOWN_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "Rating scale") {
    const isLegacyNumericScale = !field.ratingOptions || field.ratingOptions.length === 0;
    return (
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onBlur(e.target.value);
        }}
        className={selectClass}
      >
        <option value="">—</option>
        {ratingOptionsFor(field).map((opt) => (
          <option key={opt} value={opt}>
            {isLegacyNumericScale ? `${opt} / 5` : opt}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onBlur(e.target.value)}
      className={`h-[34px] w-full min-w-[110px] rounded-md border px-2 text-caption text-text-primary ${borderClass}`}
    />
  );
}

// A cell marked absent / exempted / n.a. is deliberately empty, not blank.
export function isBlank(data: Record<string, string>, key: string): boolean {
  return !explicitScoreState(data, key) && !(data[key] ?? "").trim();
}
