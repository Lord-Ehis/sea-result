import type { GradeBand, GridRemarksEntry, TemplateField } from "@/app/admin/result-templates/actions";
import { ordinal } from "@/lib/template-compute";
import { termLabel, type TermNumber } from "@/lib/term-number";

// The Term 3 annual summary (spec §6). Pure — the same code produces the
// admin's preview, the approval check and the frozen snapshot.
//
// Rules that matter:
//  * a missing term is never counted as zero — it's held, excluded, or
//    explicitly marked not enrolled, depending on policy;
//  * annual subject average = Σ(term total × term weight) ÷ Σ(eligible weights);
//  * subjects match by stable id, and one absent from a term is "not
//    applicable" for that term, not zero;
//  * every figure carries the source result/snapshot it came from.

/** The Grid field that carries the annual summary, if this template has one switched on. */
export function findAnnualGrid(fields: TemplateField[]): TemplateField | null {
  return fields.find((f) => f.type === "Grid" && f.grid?.annualSummary === true) ?? null;
}

export type AnnualPolicy = "BLOCK" | "CALCULATE_AVAILABLE";

export type AnnualSettings = {
  weights: Record<TermNumber, number>;
  policy: AnnualPolicy;
  showPosition: boolean;
};

export const DEFAULT_ANNUAL_SETTINGS: AnnualSettings = {
  weights: { 1: 33.33, 2: 33.33, 3: 33.34 },
  policy: "BLOCK",
  showPosition: false,
};

export function weightsTotal(weights: Record<TermNumber, number>): number {
  return weights[1] + weights[2] + weights[3];
}

export function weightsAreValid(weights: Record<TermNumber, number>): boolean {
  return Object.values(weights).every((w) => Number.isFinite(w) && w >= 0) && Math.abs(weightsTotal(weights) - 100) < 0.005;
}

export type TermState = "published" | "not_enrolled" | "exempt" | "missing";

export type EarlierTerm = {
  termNumber: 1 | 2;
  resultId: string;
  snapshotId: string | null;
  snapshotVersion: number | null;
  totals: Record<string, string | undefined>; // subjectId → term total, full precision
};

export type AnnualStudentInput = {
  studentId: string;
  resultId: string;
  term3Totals: Record<string, string | undefined>;
  earlier: EarlierTerm[];
  exceptions: { termNumber: number; status: "NOT_ENROLLED" | "EXEMPT" }[];
};

export type AnnualSubjectRow = {
  subjectId: string;
  name: string;
  // null = no figure for that term (not enrolled / not offered) — shown "—", never zero
  t1: string | null;
  t2: string | null;
  t3: string | null;
  average: string | null;
  grade: string;
  remarks: string;
};

export type AnnualSource = { termNumber: number; resultId: string; snapshotId: string | null; snapshotVersion: number | null };

// What's frozen into the snapshot and shown to parents.
export type AnnualSummaryPayload = {
  weights: { t1: number; t2: number; t3: number };
  policy: AnnualPolicy;
  termStates: { t1: TermState; t2: TermState; t3: TermState };
  incomplete: boolean;
  note: string | null; // e.g. "Based on 2nd Term and 3rd Term"
  subjects: AnnualSubjectRow[];
  overall: { average: string | null; grade: string };
  position: string | null;
  promotion: { status: string; promotedToClass: string | null } | null;
  sources: AnnualSource[];
};

export type AnnualComputed = {
  studentId: string;
  // Non-empty means the annual summary can't be produced yet (policy BLOCK).
  blockers: string[];
  termStates: { t1: TermState; t2: TermState; t3: TermState };
  annual: Omit<AnnualSummaryPayload, "promotion"> | null;
};

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function toTotal(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Highest band whose minimum the average reaches — robust to whole-number band boundaries. */
export function gradeForAverage(value: number, bands: GradeBand[]): string {
  const band = [...bands].sort((a, b) => b.min - a.min).find((b) => value >= b.min);
  return band?.label ?? "";
}

function listTerms(numbers: number[]): string {
  const names = numbers.map((n) => termLabel(n as TermNumber));
  return names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function computeAnnualSummaries(input: {
  subjects: { id: string; name: string }[];
  gradeBands: GradeBand[];
  remarksMap: GridRemarksEntry[];
  settings: AnnualSettings;
  students: AnnualStudentInput[];
}): AnnualComputed[] {
  const { subjects, gradeBands, remarksMap, settings } = input;
  const remarksFor = (grade: string) => remarksMap.find((m) => m.grade === grade)?.remarks ?? "";

  const results: AnnualComputed[] = input.students.map((s) => {
    const stateOf = (t: 1 | 2): TermState => {
      const exception = s.exceptions.find((e) => e.termNumber === t);
      if (exception) return exception.status === "EXEMPT" ? "exempt" : "not_enrolled";
      return s.earlier.some((e) => e.termNumber === t) ? "published" : "missing";
    };
    const termStates = { t1: stateOf(1), t2: stateOf(2), t3: "published" as TermState };

    const missing = ([1, 2] as const).filter((t) => termStates[`t${t}`] === "missing");
    if (missing.length > 0 && settings.policy === "BLOCK") {
      return {
        studentId: s.studentId,
        blockers: missing.map((t) => `no published ${termLabel(t)} result (publish it, or mark the student not enrolled)`),
        termStates,
        annual: null,
      };
    }

    // Terms that can contribute: published, and this term. Missing (under the
    // calculate-available policy), not-enrolled and exempt terms are dropped.
    const eligible = ([1, 2, 3] as const).filter((t) => termStates[`t${t}`] === "published");
    const incomplete = missing.length > 0;

    const totalFor = (subjectId: string, t: 1 | 2 | 3): number | null =>
      t === 3 ? toTotal(s.term3Totals[subjectId]) : toTotal(s.earlier.find((e) => e.termNumber === t)?.totals[subjectId]);

    const rows: AnnualSubjectRow[] = subjects.map((subject) => {
      const per = { 1: totalFor(subject.id, 1), 2: totalFor(subject.id, 2), 3: totalFor(subject.id, 3) };
      const contributing = eligible.filter((t) => per[t] !== null);
      const weightSum = contributing.reduce((sum, t) => sum + settings.weights[t], 0);
      const average = weightSum > 0 ? round4(contributing.reduce((sum, t) => sum + (per[t] as number) * settings.weights[t], 0) / weightSum) : null;
      const grade = average === null ? "" : gradeForAverage(average, gradeBands);
      const cell = (t: 1 | 2 | 3) => (eligible.includes(t) && per[t] !== null ? String(round4(per[t] as number)) : null);
      return {
        subjectId: subject.id,
        name: subject.name,
        t1: cell(1),
        t2: cell(2),
        t3: cell(3),
        average: average === null ? null : String(average),
        grade,
        remarks: remarksFor(grade),
      };
    });

    const averages = rows.map((r) => (r.average === null ? null : Number(r.average))).filter((n): n is number => n !== null);
    const overallAverage = averages.length > 0 ? round4(averages.reduce((a, b) => a + b, 0) / averages.length) : null;

    const sources: AnnualSource[] = [
      ...s.earlier
        .filter((e) => eligible.includes(e.termNumber))
        .sort((a, b) => a.termNumber - b.termNumber)
        .map((e) => ({ termNumber: e.termNumber, resultId: e.resultId, snapshotId: e.snapshotId, snapshotVersion: e.snapshotVersion })),
      { termNumber: 3, resultId: s.resultId, snapshotId: null, snapshotVersion: null },
    ];

    return {
      studentId: s.studentId,
      blockers: [],
      termStates,
      annual: {
        weights: { t1: settings.weights[1], t2: settings.weights[2], t3: settings.weights[3] },
        policy: settings.policy,
        termStates,
        incomplete,
        note: eligible.length < 3 ? `Based on ${listTerms([...eligible])}` : null,
        subjects: rows,
        overall: { average: overallAverage === null ? null : String(overallAverage), grade: overallAverage === null ? "" : gradeForAverage(overallAverage, gradeBands) },
        position: null,
        sources,
      },
    };
  });

  if (settings.showPosition) {
    // Standard competition ranking (1, 2, 2, 4). A student whose year is
    // incomplete isn't ranked against complete ones — they show no position.
    const ranked = results
      .filter((r) => r.annual && !r.annual.incomplete && r.annual.overall.average !== null)
      .map((r) => ({ r, value: Number(r.annual!.overall.average) }))
      .sort((a, b) => b.value - a.value);
    let rank = 0;
    let last: number | null = null;
    ranked.forEach(({ r, value }, i) => {
      if (last === null || value !== last) rank = i + 1;
      last = value;
      r.annual!.position = ordinal(rank);
    });
  }

  return results;
}
