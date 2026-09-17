import type { TemplateField, ComputedFormula } from "@/app/admin/result-templates/actions";

// Pure computation, safe to import from both client components (live
// preview as a teacher types) and server actions (authoritative
// recompute on save/publish) — no DB/env access.

function toNumber(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fieldName(fields: TemplateField[], id: string): string {
  return fields.find((f) => f.id === id)?.name || "Untitled field";
}

/**
 * Turns a "promotion" formula's criteria + this student's already-computed
 * data into a readable, multi-line (\n-joined) narrative — e.g. a report
 * card's "Result Analysis (Criteria for passing)" section. Reuses the
 * promotion field's config as the single source of truth rather than a
 * second, independently-configured copy of the same criteria.
 */
function buildResultAnalysis(
  formula: Extract<ComputedFormula, { kind: "promotion" }>,
  fields: TemplateField[],
  result: Record<string, string>,
): string {
  const offered = formula.subjectFields.filter((id) => (result[id] ?? "").trim() !== "");
  const passed = offered.filter((id) => toNumber(result[id]) >= formula.passMark);

  const lines: string[] = [];
  if (formula.compulsoryFields.length > 0) {
    const names = formula.compulsoryFields.map((id) => fieldName(fields, id));
    const verdicts = formula.compulsoryFields
      .map((id) => `You ${toNumber(result[id]) >= formula.passMark ? "passed" : "failed"} ${fieldName(fields, id)}`)
      .join(". ");
    lines.push(`Compulsory subjects to pass are ${names.join(" and ")}. ${verdicts}.`);
  }
  lines.push(`Minimum subjects to offer is ${formula.minOffered}, you offered ${offered.length}.`);
  lines.push(`Minimum subjects to pass is ${formula.minPassed}, you passed ${passed.length} (pass mark is ${formula.passMark}).`);
  lines.push(`Promotion score is ${formula.promotionScore}, you scored ${toNumber(result[formula.overallField])}.`);

  return lines.join("\n");
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * Fills in sum/average/grade values for one student's own row. Position
 * fields are left untouched — ranking needs the whole batch, not just one
 * student's data (see computePositions).
 */
export function computeOwnFields(fields: TemplateField[], data: Record<string, string>): Record<string, string> {
  const result = { ...data };

  for (const field of fields) {
    if (field.type !== "Computed" || !field.formula) continue;
    const formula = field.formula;

    if (formula.kind === "sum") {
      result[field.id] = String(formula.of.reduce((sum, id) => sum + toNumber(result[id]), 0));
    } else if (formula.kind === "average") {
      result[field.id] = formula.of.length === 0 ? "" : (formula.of.reduce((sum, id) => sum + toNumber(result[id]), 0) / formula.of.length).toFixed(2);
    } else if (formula.kind === "grade") {
      const value = toNumber(result[formula.of]);
      const band = formula.bands.find((b) => value >= b.min && value <= b.max);
      result[field.id] = band?.label ?? "";
    } else if (formula.kind === "promotion") {
      const offered = formula.subjectFields.filter((id) => (result[id] ?? "").trim() !== "");
      const passed = offered.filter((id) => toNumber(result[id]) >= formula.passMark);
      const compulsoryOk = formula.compulsoryFields.every((id) => toNumber(result[id]) >= formula.passMark);
      const overallOk = toNumber(result[formula.overallField]) >= formula.promotionScore;
      const meetsOffered = offered.length >= formula.minOffered;
      const meetsPassed = passed.length >= formula.minPassed;
      result[field.id] = compulsoryOk && overallOk && meetsOffered && meetsPassed ? "Passed" : "Failed";
    } else if (formula.kind === "remarksLookup") {
      result[field.id] = formula.map.find((m) => m.grade === result[formula.of])?.remarks ?? "";
    } else if (formula.kind === "resultAnalysis") {
      const promotionField = fields.find((f) => f.id === formula.of);
      result[field.id] =
        promotionField?.formula?.kind === "promotion" ? buildResultAnalysis(promotionField.formula, fields, result) : "";
    }
  }

  return result;
}

/**
 * Sums or averages a set of numeric values gathered across terms for one
 * student (see publishBatch, which assembles `values` from this student's
 * own prior published Result rows plus their newly-computed current term).
 */
export function aggregateCumulative(aggregate: "sum" | "average", values: number[]): string {
  if (values.length === 0) return "";
  const total = values.reduce((sum, v) => sum + v, 0);
  return aggregate === "sum" ? String(total) : (total / values.length).toFixed(2);
}

/**
 * Fills in every position-kind field by ranking students against each
 * other on their (already own-computed) source field. Competition
 * ranking: tied values share a rank, the next distinct value skips ahead
 * (1st, 2nd, 2nd, 4th). Students with no numeric source value get "—".
 */
export function computePositions(fields: TemplateField[], studentsData: Record<string, string>[]): Record<string, string>[] {
  const results = studentsData.map((d) => ({ ...d }));

  for (const field of fields) {
    if (field.type !== "Computed" || field.formula?.kind !== "position") continue;
    const sourceId = field.formula.of;

    const ranked = studentsData
      .map((d, index) => ({ index, value: Number(d[sourceId]) }))
      .filter((r) => Number.isFinite(r.value))
      .sort((a, b) => b.value - a.value);

    let rank = 0;
    let lastValue: number | null = null;
    ranked.forEach((r, i) => {
      if (lastValue === null || r.value !== lastValue) rank = i + 1;
      lastValue = r.value;
      results[r.index][field.id] = ordinal(rank);
    });

    for (const d of results) {
      if (d[field.id] === undefined) d[field.id] = "—";
    }
  }

  return results;
}
