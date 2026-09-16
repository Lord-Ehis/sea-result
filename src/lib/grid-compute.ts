import type { TemplateField } from "@/app/admin/result-templates/actions";

// Pure translation layer for the "Grid" field type (a subjects × columns
// table, e.g. a report card's Cognitive Domain section). Rather than a
// parallel compute engine, this synthesizes virtual TemplateFields — one
// per subject per computed column, with composite ids — and feeds them
// into the existing, unmodified computeOwnFields/computePositions in
// template-compute.ts. Grid cell values live in Result.data (still a flat
// Record<string,string>) under these same composite keys, so no other
// code that looks up data by field id is affected.

export function gridKey(fieldId: string, subjectId: string, columnKey: string): string {
  return `${fieldId}:${subjectId}:${columnKey}`;
}

/**
 * Per subject: Term Total (sum of the raw score columns), Grade (from the
 * grid's grade bands), Remarks (looked up from the grid's remarks map).
 * Safe to compute live (client + server) — only needs this student's own
 * row, unlike Subject Position or Cumulative Result (a later round).
 */
export function expandGridThisTermFields(field: TemplateField): TemplateField[] {
  if (field.type !== "Grid" || !field.grid) return [];
  const { subjects, rawColumns, gradeBands, remarksMap } = field.grid;

  return subjects.flatMap((subject): TemplateField[] => {
    const totalId = gridKey(field.id, subject.id, "termTotal");
    const gradeId = gridKey(field.id, subject.id, "grade");
    return [
      {
        id: totalId,
        name: `${subject.name} Term Total`,
        type: "Computed",
        formula: { kind: "sum", of: rawColumns.map((c) => gridKey(field.id, subject.id, c.id)) },
      },
      {
        id: gradeId,
        name: `${subject.name} Grade`,
        type: "Computed",
        formula: { kind: "grade", of: totalId, bands: gradeBands },
      },
      {
        id: gridKey(field.id, subject.id, "remarks"),
        name: `${subject.name} Remarks`,
        type: "Computed",
        formula: { kind: "remarksLookup", of: gradeId, map: remarksMap },
      },
    ];
  });
}

/** Every raw (teacher-entered) score cell's composite key, for completeness checks. */
export function gridRawKeys(field: TemplateField): string[] {
  if (field.type !== "Grid" || !field.grid) return [];
  return field.grid.subjects.flatMap((subject) => field.grid!.rawColumns.map((c) => gridKey(field.id, subject.id, c.id)));
}

/**
 * A template's full field list with every Grid field replaced by its
 * this-term virtual fields, ready to pass to computeOwnFields. For a
 * template with no Grid field this returns the list unchanged (content-
 * identical), so non-grid templates flow through every caller exactly as
 * before.
 */
export function expandThisTermFields(fields: TemplateField[]): TemplateField[] {
  return [
    ...fields.filter((f) => f.type !== "Grid"),
    ...fields.filter((f) => f.type === "Grid").flatMap(expandGridThisTermFields),
  ];
}
