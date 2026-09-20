import type { PromotionStatus } from "@prisma/client";
import type { TemplateField } from "@/app/admin/result-templates/actions";
import { prisma } from "@/lib/prisma";
import { gridKey } from "@/lib/grid-compute";
import {
  DEFAULT_ANNUAL_SETTINGS,
  computeAnnualSummaries,
  findAnnualGrid,
  weightsAreValid,
  type AnnualComputed,
  type AnnualSettings,
  type AnnualSummaryPayload,
  type EarlierTerm,
} from "@/lib/annual-summary";

// The database side of the annual summary: loads the school's settings, each
// student's earlier *published* terms and any not-enrolled/exempt marks, then
// hands everything to the pure computation. Approval, publishing, the review
// page and "preview as parent" all go through here so they can't disagree.

export async function loadAnnualSettings(schoolId: string): Promise<AnnualSettings> {
  const row = await prisma.annualSummarySettings.findUnique({ where: { schoolId } });
  if (!row) return DEFAULT_ANNUAL_SETTINGS;
  return {
    weights: { 1: row.term1Weight.toNumber(), 2: row.term2Weight.toNumber(), 3: row.term3Weight.toNumber() },
    policy: row.incompleteYearPolicy,
    showPosition: row.showAnnualPosition,
  };
}

export type BatchAnnualInput = {
  schoolId: string;
  batch: { id: string; templateId: string; session: string; termNumber: number | null };
  fields: TemplateField[];
  rows: {
    id: string;
    studentId: string;
    studentName: string;
    data: Record<string, string>;
    promotionStatus: PromotionStatus | null;
    promotedToClassId: string | null;
  }[];
};

export type BatchAnnualStudent = {
  studentId: string;
  resultId: string;
  studentName: string;
  termStates: AnnualComputed["termStates"];
  blockers: string[];
  payload: AnnualSummaryPayload | null;
};

export type BatchAnnual = {
  settings: AnnualSettings;
  weightsOk: boolean;
  students: BatchAnnualStudent[];
  // Everything that stops this batch from being approved or published, in words.
  issues: { studentId: string; student: string; message: string }[];
};

/** Null when the batch has no annual summary: not annual-enabled, or not a Term 3 batch. */
export async function computeBatchAnnual(input: BatchAnnualInput): Promise<BatchAnnual | null> {
  const gridField = findAnnualGrid(input.fields);
  if (!gridField?.grid || input.batch.termNumber !== 3) return null;
  const grid = gridField.grid;

  const studentIds = input.rows.map((r) => r.studentId);
  const [settings, priorRows, exceptions, classes] = await Promise.all([
    loadAnnualSettings(input.schoolId),
    prisma.result.findMany({
      where: {
        schoolId: input.schoolId,
        templateId: input.batch.templateId,
        session: input.batch.session,
        studentId: { in: studentIds },
        status: "PUBLISHED",
        batch: { termNumber: { in: [1, 2] } },
      },
      include: {
        batch: { select: { termNumber: true } },
        snapshots: { where: { supersededAt: null }, orderBy: { version: "desc" }, take: 1, select: { id: true, version: true } },
      },
    }),
    prisma.studentTermException.findMany({ where: { schoolId: input.schoolId, session: input.batch.session, studentId: { in: studentIds } } }),
    prisma.class.findMany({ where: { schoolId: input.schoolId, id: { in: input.rows.map((r) => r.promotedToClassId).filter((id): id is string => !!id) } }, select: { id: true, name: true } }),
  ]);
  const className = new Map(classes.map((c) => [c.id, c.name]));

  const totalsOf = (data: Record<string, string>) =>
    Object.fromEntries(grid.subjects.map((s) => [s.id, data[gridKey(gridField.id, s.id, "termTotal")]]));

  const computed = computeAnnualSummaries({
    subjects: grid.subjects,
    gradeBands: grid.gradeBands,
    remarksMap: grid.remarksMap,
    settings,
    students: input.rows.map((row) => ({
      studentId: row.studentId,
      resultId: row.id,
      term3Totals: totalsOf(row.data),
      earlier: priorRows
        .filter((p) => p.studentId === row.studentId && (p.batch?.termNumber === 1 || p.batch?.termNumber === 2))
        .map(
          (p): EarlierTerm => ({
            termNumber: p.batch!.termNumber as 1 | 2,
            resultId: p.id,
            snapshotId: p.snapshots[0]?.id ?? null,
            snapshotVersion: p.snapshots[0]?.version ?? null,
            totals: totalsOf((p.data as Record<string, string>) ?? {}),
          }),
        ),
      exceptions: exceptions
        .filter((e) => e.studentId === row.studentId)
        .map((e) => ({ termNumber: e.termNumber, status: e.status })),
    })),
  });

  const weightsOk = weightsAreValid(settings.weights);
  const issues: BatchAnnual["issues"] = [];
  if (!weightsOk) {
    issues.push({ studentId: "", student: "Whole batch", message: "the school's term weights don't total 100% (fix them in Result templates → Annual summary)" });
  }

  const students = computed.map((c, i): BatchAnnualStudent => {
    const row = input.rows[i];
    for (const message of c.blockers) issues.push({ studentId: row.studentId, student: row.studentName, message });
    if (!row.promotionStatus) {
      issues.push({ studentId: row.studentId, student: row.studentName, message: "no promotion decision yet" });
    } else if (row.promotionStatus === "PROMOTED" && !row.promotedToClassId) {
      issues.push({ studentId: row.studentId, student: row.studentName, message: "promoted, but no class chosen" });
    }
    return {
      studentId: row.studentId,
      resultId: row.id,
      studentName: row.studentName,
      termStates: c.termStates,
      blockers: c.blockers,
      payload: c.annual
        ? {
            ...c.annual,
            promotion: row.promotionStatus
              ? { status: row.promotionStatus, promotedToClass: row.promotedToClassId ? (className.get(row.promotedToClassId) ?? null) : null }
              : null,
          }
        : null,
    };
  });

  return { settings, weightsOk, students, issues };
}

export function describeIssues(annual: BatchAnnual): string {
  const shown = annual.issues
    .slice(0, 5)
    .map((i) => `${i.student} — ${i.message}`)
    .join("; ");
  const more = annual.issues.length > 5 ? ` (and ${annual.issues.length - 5} more)` : "";
  return `${shown}${more}`;
}
