import type { TemplateField } from "@/app/admin/result-templates/actions";
import { SCORE_STATE_LABEL, explicitScoreState, formatScore } from "@/lib/score-state";

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
  // Only templates activated from a version (every column carries a weight)
  // use weighted totals; older ones keep the flat sum so no number changes.
  const weighted = field.grid.weighted === true && rawColumns.every((c) => typeof c.weight === "number");

  return subjects.flatMap((subject): TemplateField[] => {
    const totalId = gridKey(field.id, subject.id, "termTotal");
    const gradeId = gridKey(field.id, subject.id, "grade");
    return [
      {
        id: totalId,
        name: `${subject.name} Term Total`,
        type: "Computed",
        formula: weighted
          ? {
              kind: "weightedSum",
              parts: rawColumns.map((c) => ({ key: gridKey(field.id, subject.id, c.id), max: c.maxMark, weight: c.weight ?? 0 })),
            }
          : { kind: "sum", of: rawColumns.map((c) => gridKey(field.id, subject.id, c.id)) },
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
 * Per subject: Class Average — the mean Term Total across every student in
 * the published batch. Same value for every student, unlike Subject
 * Position. Publish-time only, for the same reason as Subject Position.
 */
export function expandGridClassAverageFields(field: TemplateField): TemplateField[] {
  if (field.type !== "Grid" || !field.grid) return [];
  return field.grid.subjects.map((subject) => ({
    id: gridKey(field.id, subject.id, "classAverage"),
    name: `${subject.name} Class Average`,
    type: "Computed",
    formula: { kind: "classAverage", of: gridKey(field.id, subject.id, "termTotal") },
  }));
}

/**
 * Per subject, only when the grid's "Include cumulative result" toggle is
 * on: Cumulative Total/Average (the existing "cumulative" formula kind,
 * same as a flat field's — publishBatch's existing prior-published-rows
 * loop resolves these with no changes), Cumulative Grade/Remarks (of the
 * average), and Cumulative Position (batch-wide rank by cumulative
 * average). All publish-time only, like Subject Position.
 */
export function expandGridCumulativeFields(field: TemplateField): TemplateField[] {
  if (field.type !== "Grid" || !field.grid || !field.grid.includeCumulative) return [];
  const { subjects, gradeBands, remarksMap } = field.grid;

  return subjects.flatMap((subject): TemplateField[] => {
    const totalId = gridKey(field.id, subject.id, "termTotal");
    const cumulativeTotalId = gridKey(field.id, subject.id, "cumulativeTotal");
    const cumulativeAverageId = gridKey(field.id, subject.id, "cumulativeAverage");
    const cumulativeGradeId = gridKey(field.id, subject.id, "cumulativeGrade");
    return [
      {
        id: cumulativeTotalId,
        name: `${subject.name} Cumulative Total`,
        type: "Computed",
        formula: { kind: "cumulative", of: totalId, aggregate: "sum" },
      },
      {
        id: cumulativeAverageId,
        name: `${subject.name} Cumulative Average`,
        type: "Computed",
        formula: { kind: "cumulative", of: totalId, aggregate: "average" },
      },
      {
        id: cumulativeGradeId,
        name: `${subject.name} Cumulative Grade`,
        type: "Computed",
        formula: { kind: "grade", of: cumulativeAverageId, bands: gradeBands },
      },
      {
        id: gridKey(field.id, subject.id, "cumulativeRemarks"),
        name: `${subject.name} Cumulative Remarks`,
        type: "Computed",
        formula: { kind: "remarksLookup", of: cumulativeGradeId, map: remarksMap },
      },
      {
        id: gridKey(field.id, subject.id, "cumulativePosition"),
        name: `${subject.name} Cumulative Position`,
        type: "Computed",
        formula: { kind: "position", of: cumulativeAverageId },
      },
    ];
  });
}

/**
 * Pulls this student's individual prior Term Totals (one per subject) into
 * named First/Second/Third Term slots, right-aligned so the term just
 * published always lands in its true chronological slot — e.g. publishing
 * a 4th term in one session shows terms 2/3/4 rather than silently
 * dropping the newest. Cumulative Total/Average already sum/average every
 * term regardless of how many slots exist, so nothing is lost from the
 * aggregate side even if a slot rolls off.
 *
 * A different shape than the aggregate cumulative fields above (pulling
 * individual historical values, not folding them into one number), so
 * this runs as its own pass in publishBatch rather than through
 * computeOwnFields.
 */
export function fillGridCumulativeTermSlots(
  field: TemplateField,
  data: Record<string, string>,
  priorRowsDataAsc: Record<string, string>[],
): Record<string, string> {
  if (field.type !== "Grid" || !field.grid || !field.grid.includeCumulative) return data;
  const result = { ...data };
  const slotKeys = ["firstTerm", "secondTerm", "thirdTerm"] as const;

  for (const subject of field.grid.subjects) {
    const totalKey = gridKey(field.id, subject.id, "termTotal");
    const priorTotals = priorRowsDataAsc.map((d) => d[totalKey]).filter((v): v is string => v !== undefined);
    const allTerms = [...priorTotals, result[totalKey]].filter((v): v is string => v !== undefined).slice(-3);
    allTerms.forEach((value, i) => {
      result[gridKey(field.id, subject.id, slotKeys[slotKeys.length - allTerms.length + i])] = value;
    });
  }

  return result;
}

/**
 * A template's full field list expanded for publishBatch specifically:
 * this-term virtual fields plus Subject Position (batch-wide, so only
 * meaningful at publish time — never during live entry/review, unlike
 * expandThisTermFields) and, when enabled, Cumulative Result fields. For a
 * template with no Grid field this is content-identical to `fields`.
 */
export function expandForPublish(fields: TemplateField[]): TemplateField[] {
  const gridFields = fields.filter((f) => f.type === "Grid" && f.grid);
  return [
    ...fields.filter((f) => f.type !== "Grid"),
    ...gridFields.flatMap(expandGridThisTermFields),
    ...gridFields.flatMap(expandGridPositionFields),
    ...gridFields.flatMap(expandGridClassAverageFields),
    ...gridFields.flatMap(expandGridCumulativeFields),
  ];
}

/** This-term (+ Cumulative Result, when enabled) display columns for a Grid field's read-only rendering. */
export function gridDisplayColumns(field: TemplateField): { key: string; label: string }[] {
  if (field.type !== "Grid" || !field.grid) return [];
  const columns = [
    ...field.grid.rawColumns.map((c) => ({ key: c.id, label: c.name })),
    { key: "termTotal", label: "Total" },
    { key: "grade", label: "Grade" },
    { key: "subjectPosition", label: "Position" },
    { key: "remarks", label: "Remarks" },
    { key: "classAverage", label: "Class Avg" },
  ];
  if (field.grid.includeCumulative) {
    columns.push(
      { key: "firstTerm", label: "First Term" },
      { key: "secondTerm", label: "Second Term" },
      { key: "thirdTerm", label: "Third Term" },
      { key: "cumulativeTotal", label: "Cumulative Total" },
      { key: "cumulativeAverage", label: "Cumulative Average" },
      { key: "cumulativeGrade", label: "Cumulative Grade" },
      { key: "cumulativePosition", label: "Cumulative Position" },
      { key: "cumulativeRemarks", label: "Cumulative Remarks" },
    );
  }
  return columns;
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
          f.grid!.subjects.map((s) => [
            s.id,
            Object.fromEntries(
              columns.map((c) => {
                const key = gridKey(f.id, s.id, c.key);
                const state = explicitScoreState(data, key);
                if (state) return [c.key, SCORE_STATE_LABEL[state]];
                return [c.key, c.key === "termTotal" ? formatScore(data[key]) : (data[key] ?? "")];
              }),
            ),
          ]),
        ),
      };
    });
}

export type GradingScaleLegendEntry = { gradeCode: string; minScore: number; maxScore: number; remark: string };

/**
 * The grading scale legend (e.g. "70–100 = A (Excellent)") for a template's
 * first Grid field, highest band first — the same bands/remarks already
 * compiled onto the grid for live grading (src/lib/version-compile.ts), just
 * read back out for display rather than computation. A template with no Grid
 * field, or a Grid with no configured bands, has no legend to show.
 */
export function gradingScaleLegend(fields: TemplateField[]): GradingScaleLegendEntry[] {
  const grid = fields.find((f) => f.type === "Grid" && !!f.grid)?.grid;
  if (!grid || grid.gradeBands.length === 0) return [];
  const remarkFor = new Map(grid.remarksMap.map((r) => [r.grade, r.remarks]));
  return [...grid.gradeBands]
    .sort((a, b) => b.min - a.min)
    .map((b) => ({ gradeCode: b.label, minScore: b.min, maxScore: b.max, remark: remarkFor.get(b.label) ?? "" }));
}
