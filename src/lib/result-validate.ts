import type { TemplateField } from "@/app/admin/result-templates/actions";
import { gridKey } from "@/lib/grid-compute";
import { DROPDOWN_OPTIONS, ratingOptionsFor } from "@/lib/field-options";
import { explicitScoreState, isStateKey, scoreStateKey, EXPLICIT_SCORE_STATES } from "@/lib/score-state";

// Entry validation (spec §7.2/§7.3). Pure — the entry screen runs it for
// instant feedback and the server actions run the same code as the
// authority, so the two can never disagree.
//
//  errors   → the value itself is wrong (not a number, below 0, above the
//             component maximum, not a valid option). Never saved.
//  missing  → a required value is still blank with no absent/exempted state.
//             Saving a draft is fine; submitting is blocked.

export type EntryIssue = {
  key: string;
  label: string; // e.g. "Mathematics · 1st CA" or "Attendance"
  message: string;
};

export type EntryValidation = { errors: EntryIssue[]; missing: EntryIssue[] };

/** Every key a student's data may legitimately contain (raw cells, their state keys, flat fields). */
export function allowedDataKeys(fields: TemplateField[]): Set<string> {
  const keys = new Set<string>();
  for (const f of fields) {
    if (f.type === "Computed") continue;
    if (f.type === "Grid" && f.grid) {
      for (const s of f.grid.subjects) {
        for (const c of f.grid.rawColumns) {
          const key = gridKey(f.id, s.id, c.id);
          keys.add(key);
          keys.add(scoreStateKey(key));
        }
      }
    } else {
      keys.add(f.id);
    }
  }
  return keys;
}

/** Drops anything not entered by a teacher (computed/publish-time keys, junk). */
export function pickAllowedData(fields: TemplateField[], data: Record<string, string>): Record<string, string> {
  const allowed = allowedDataKeys(fields);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (allowed.has(k) && typeof v === "string") out[k] = v;
  }
  return out;
}

export function validateStudentEntry(fields: TemplateField[], data: Record<string, string>): EntryValidation {
  const errors: EntryIssue[] = [];
  const missing: EntryIssue[] = [];

  for (const f of fields) {
    if (f.type === "Computed") continue;

    if (f.type === "Grid" && f.grid) {
      for (const s of f.grid.subjects) {
        for (const c of f.grid.rawColumns) {
          const key = gridKey(f.id, s.id, c.id);
          const label = `${s.name || "Untitled subject"} · ${c.name || "score"}`;

          const rawState = data[scoreStateKey(key)];
          if (rawState && !(EXPLICIT_SCORE_STATES as readonly string[]).includes(rawState)) {
            errors.push({ key: scoreStateKey(key), label, message: "Unknown score status." });
            continue;
          }
          if (explicitScoreState(data, key)) continue; // absent / exempted / n.a.: the value is ignored

          const value = (data[key] ?? "").trim();
          if (value === "") {
            if (c.required !== false) missing.push({ key, label, message: "Score is missing." });
            continue;
          }
          const n = Number(value);
          if (!Number.isFinite(n)) errors.push({ key, label, message: "Must be a number." });
          else if (n < 0 || n > c.maxMark) errors.push({ key, label, message: `Must be between 0 and ${c.maxMark}.` });
        }
      }
      continue;
    }

    const value = (data[f.id] ?? "").trim();
    if (value === "") {
      missing.push({ key: f.id, label: f.name || "Untitled field", message: "Required." });
      continue;
    }
    if (f.type === "Number" && !Number.isFinite(Number(value))) {
      errors.push({ key: f.id, label: f.name, message: "Must be a number." });
    } else if (f.type === "Dropdown" && !DROPDOWN_OPTIONS.includes(value)) {
      errors.push({ key: f.id, label: f.name, message: "Not a valid option." });
    } else if (f.type === "Rating scale" && !ratingOptionsFor(f).includes(value)) {
      errors.push({ key: f.id, label: f.name, message: "Not a valid rating." });
    }
  }

  return { errors, missing };
}

/** True when a single edited key is acceptable — used for one-cell edits during admin review. */
export function validateSingleValue(fields: TemplateField[], key: string, value: string): string | null {
  if (isStateKey(key)) {
    return value === "" || (EXPLICIT_SCORE_STATES as readonly string[]).includes(value) ? null : "Unknown score status.";
  }
  const allowed = allowedDataKeys(fields);
  if (!allowed.has(key)) return "That field can't be edited.";
  const probe = validateStudentEntry(fields, { [key]: value });
  return probe.errors.find((e) => e.key === key)?.message ?? null;
}

export type ClassWarning = { message: string };

/**
 * Spec §7.3: an unusually high number of identical scores in one component
 * is worth a second look but never blocks submission. Needs a class-sized
 * sample, so it stays quiet under five students.
 */
export function identicalScoreWarnings(fields: TemplateField[], dataByStudent: Record<string, string>[]): ClassWarning[] {
  const warnings: ClassWarning[] = [];
  const grid = fields.find((f) => f.type === "Grid" && f.grid);
  if (!grid?.grid) return warnings;

  for (const s of grid.grid.subjects) {
    for (const c of grid.grid.rawColumns) {
      const key = gridKey(grid.id, s.id, c.id);
      const scores = dataByStudent
        .filter((d) => !explicitScoreState(d, key))
        .map((d) => (d[key] ?? "").trim())
        .filter((v) => v !== "");
      if (scores.length < 5) continue;

      const counts = new Map<string, number>();
      for (const v of scores) counts.set(v, (counts.get(v) ?? 0) + 1);
      const [topValue, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (topCount / scores.length >= 0.8) {
        warnings.push({
          message: `${s.name || "Untitled subject"} · ${c.name || "score"}: ${topCount} of ${scores.length} students have the same score (${topValue}).`,
        });
      }
    }
  }
  return warnings;
}
