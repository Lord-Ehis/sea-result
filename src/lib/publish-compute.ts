import type { TemplateField } from "@/app/admin/result-templates/actions";
import { computeOwnFields, computePositions, computeClassAverages, aggregateCumulative } from "@/lib/template-compute";
import { expandForPublish, fillGridCumulativeTermSlots } from "@/lib/grid-compute";

// Everything that only becomes known once a whole batch is published: the
// per-student totals/grades, cross-term Cumulative values, and class
// positions. Pure, so "preview as parent" and the real publish run the exact
// same code — what the admin previews is what gets frozen.

export type PublishRow = { studentId: string; session: string; data: Record<string, string> };
export type PriorPublishedRow = { studentId: string; session: string; publishedAt: Date | null; data: Record<string, string> };

/** Cumulative fields need each student's earlier published terms; nothing else does. */
export function needsPriorRows(fields: TemplateField[]): boolean {
  return expandForPublish(fields).some((f) => f.type === "Computed" && f.formula?.kind === "cumulative");
}

export function computePublishData(rows: PublishRow[], fields: TemplateField[], priorRows: PriorPublishedRow[]): Record<string, string>[] {
  // Grid fields don't carry values directly — expand them into virtual
  // per-subject fields so the rest of the pipeline (flat, single-value
  // fields) treats them like any other Computed field. Includes Subject
  // Position and Cumulative Result fields (batch/cross-term, publish-time
  // only). For a template with no Grid field this equals `fields`.
  const expandedFields = expandForPublish(fields);
  const gridFields = fields.filter((f) => f.type === "Grid" && f.grid && f.grid.includeCumulative);
  const ownComputed = rows.map((r) => computeOwnFields(expandedFields, r.data));

  const cumulativeFields = expandedFields.filter((f) => f.type === "Computed" && f.formula?.kind === "cumulative");
  let afterCumulative = ownComputed;
  if (cumulativeFields.length > 0) {
    afterCumulative = rows.map((r, i) => {
      const data = { ...ownComputed[i] };
      const priorForStudent = priorRows.filter((p) => p.studentId === r.studentId && p.session === r.session);
      for (const field of cumulativeFields) {
        const formula = field.formula;
        if (formula?.kind !== "cumulative") continue;
        const values = [...priorForStudent.map((p) => Number(p.data?.[formula.of])), Number(ownComputed[i][formula.of])].filter((v) =>
          Number.isFinite(v),
        );
        data[field.id] = aggregateCumulative(formula.aggregate, values);
      }
      return data;
    });

    // Grid fields also need each earlier Term Total in named First/Second/
    // Third Term slots — a different shape from the aggregate above (see
    // fillGridCumulativeTermSlots), so its own pass.
    if (gridFields.length > 0) {
      afterCumulative = afterCumulative.map((data, i) => {
        let next = data;
        for (const gridField of gridFields) {
          const priorAsc = priorRows
            .filter((p) => p.studentId === rows[i].studentId && p.session === rows[i].session)
            .sort((a, b) => (a.publishedAt?.getTime() ?? 0) - (b.publishedAt?.getTime() ?? 0))
            .map((p) => p.data ?? {});
          next = fillGridCumulativeTermSlots(gridField, next, priorAsc);
        }
        return next;
      });
    }

    // Lets a grade-kind field whose `of` points at a cumulative field
    // compute now that the cumulative value exists.
    afterCumulative = afterCumulative.map((d) => computeOwnFields(expandedFields, d));
  }

  return computeClassAverages(expandedFields, computePositions(expandedFields, afterCumulative));
}
