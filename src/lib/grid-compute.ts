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

/**
 * Per subject: Subject Position — this student's rank in this subject
 * among every student in the published batch, ranked by Term Total. Only
 * meaningful batch-wide, so (like the flat "position" formula) it's only
 * ever expanded at publish time, never during live entry/review.
 */
export function expandGridPositionFields(field: TemplateField): TemplateField[] {
  if (field.type !== "Grid" || !field.grid) return [];
  return field.grid.subjects.map((subject) => ({
    id: gridKey(field.id, subject.id, "subjectPosition"),
    name: `${subject.name} Position`,
    type: "Computed",
    formula: { kind: "position", of: gridKey(field.id, subject.id, "termTotal") },
  }));
}

/**
 * A template's full field list expanded for publishBatch specifically:
 * this-term virtual fields plus Subject Position (batch-wide, so only
 * meaningful at publish time — never during live entry/review, unlike
 * expandThisTermFields). For a template with no Grid field this is
 * content-identical to `fields`.
 */
export function expandForPublish(fields: TemplateField[]): TemplateField[] {
  const gridFields = fields.filter((f) => f.type === "Grid" && f.grid);
  return [
    ...fields.filter((f) => f.type !== "Grid"),
    ...gridFields.flatMap(expandGridThisTermFields),
    ...gridFields.flatMap(expandGridPositionFields),
  ];
}

/** This-term display columns for a Grid field's read-only rendering (lookup/parent dashboard). */
export function gridDisplayColumns(field: TemplateField): { key: string; label: string }[] {
  if (field.type !== "Grid" || !field.grid) return [];
  return [
    ...field.grid.rawColumns.map((c) => ({ key: c.id, label: c.name })),
    { key: "termTotal", label: "Total" },
    { key: "grade", label: "Grade" },
    { key: "subjectPosition", label: "Position" },
    { key: "remarks", label: "Remarks" },
  ];
}

export type GridResultData = {
  fieldName: string;
  subjects: { id: string; name: string }[];
  columns: { key: string; label: string }[];
  cells: Record<string, Record<string, string>>;
};

/** Read-only per-subject cell data for every Grid field on a template, for a published Result's data. */
export function buildGridResultData(fields: TemplateField[], data: Record<string, string>): GridResultData[] {
  return fields
    .filter((f) => f.type === "Grid" && !!f.grid)
    .map((f) => {
      const columns = gridDisplayColumns(f);
      return {
        fieldName: f.name,
        subjects: f.grid!.subjects,
        columns,
        cells: Object.fromEntries(
          f.grid!.subjects.map((s) => [s.id, Object.fromEntries(columns.map((c) => [c.key, data[gridKey(f.id, s.id, c.key)] ?? ""]))]),
        ),
      };
    });
}
