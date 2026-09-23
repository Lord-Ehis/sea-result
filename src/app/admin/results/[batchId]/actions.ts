"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminAccess, type AdminAccess } from "@/lib/admin-access";
import { batchWhere, classWhere, ofStudentWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { createAndSendNotification, runWithConcurrency } from "@/lib/notifications";
import { computeOwnFields } from "@/lib/template-compute";
import { expandThisTermFields } from "@/lib/grid-compute";
import { computePublishData, needsPriorRows, type PriorPublishedRow } from "@/lib/publish-compute";
import { recordResultEvent } from "@/lib/result-events";
import { computeBatchAnnual, describeIssues } from "@/lib/annual-context";
import { termLabel, termNumberFromLabel, isTermNumber } from "@/lib/term-number";
import { findAnnualGrid } from "@/lib/annual-summary";
import { buildSnapshotPayload, generateVerificationCode, snapshotChecksum, type SnapshotPayload } from "@/lib/snapshot";
import { pickAllowedData, summarizeIssues, validateSingleValue, validateStudentEntry, type EntryIssue } from "@/lib/result-validate";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";
import type { TemplateField } from "@/app/admin/result-templates/actions";

async function requireSchoolAdmin() {
  const access = await getAdminAccess();
  return { schoolId: access.schoolId, userId: access.userId, access };
}

const TX_OPTIONS = { timeout: 120_000, maxWait: 20_000 };

// The one door to a batch: an id from another campus simply isn't found, so
// approve / publish / send back / preview / corrections all inherit the campus scope.
async function loadBatch(access: AdminAccess, batchId: string) {
  const batch = await prisma.resultBatch.findFirst({
    where: { id: batchId, schoolId: access.schoolId, ...batchWhere(access) },
    include: { class: true, template: true },
  });
  if (!batch) throw new UserError("This batch no longer exists.");
  return batch;
}

function templateFields(template: { fields: unknown }): TemplateField[] {
  return Array.isArray(template.fields) ? (template.fields as unknown as TemplateField[]) : [];
}

function loadRows(schoolId: string, batchId: string) {
  return prisma.result.findMany({
    where: { schoolId, batchId },
    include: { student: { include: { campus: true } } },
    orderBy: { student: { firstName: "asc" } },
  });
}

// The annual summary for a 3rd Term batch of an annual-enabled template; null
// for any other batch. One entry point so approval, publishing and preview
// can't disagree about what the year looks like.
async function annualFor(
  schoolId: string,
  batch: Awaited<ReturnType<typeof loadBatch>>,
  rows: Awaited<ReturnType<typeof loadRows>>,
  dataOverride?: Record<string, string>[],
) {
  return computeBatchAnnual({
    schoolId,
    batch: { id: batch.id, templateId: batch.templateId, session: batch.session, termNumber: batch.termNumber ?? termNumberFromLabel(batch.term) },
    fields: templateFields(batch.template),
    rows: rows.map((r, i) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: `${r.student.firstName} ${r.student.lastName}`,
      data: dataOverride?.[i] ?? ((r.data as Record<string, string>) ?? {}),
      promotionStatus: r.promotionStatus,
      promotedToClassId: r.promotedToClassId,
    })),
  });
}

async function loadPriorPublished(templateId: string, studentIds: string[]): Promise<PriorPublishedRow[]> {
  const prior = await prisma.result.findMany({ where: { templateId, status: "PUBLISHED", studentId: { in: studentIds } } });
  return prior.map((p) => ({ studentId: p.studentId, session: p.session, publishedAt: p.publishedAt, data: (p.data as Record<string, string>) ?? {} }));
}

// Corrections during review. Problems the admin can act on come back as
// `{ ok: false, error }` (see user-error.ts) so the message survives production.
export async function updateResultValue(resultId: string, fieldId: string, value: string): Promise<ActionResult> {
  const { schoolId, access } = await requireSchoolAdmin();
  return toResult(async () => {
    const result = await prisma.result.findFirst({ where: { id: resultId, schoolId, ...ofStudentWhere(access) }, include: { template: true } });
    if (!result) throw new UserError("Result not found.");

    // Corrections are only for the review stage: a draft belongs to the
    // teacher, and an approved or published result is frozen.
    if (result.status !== "SUBMITTED") {
      throw new UserError(`This result is ${result.status.toLowerCase()} and can't be edited during review.`);
    }

    const fields = templateFields(result.template);
    const problem = validateSingleValue(fields, fieldId, value);
    if (problem) throw new UserError(problem);

    const raw = { ...((result.data as Record<string, string>) ?? {}), [fieldId]: value };
    const data = computeOwnFields(expandThisTermFields(fields), raw);
    await prisma.result.update({ where: { id: resultId }, data: { data, revision: { increment: 1 } } });
    return {};
  });
}

// Approve and publish are deliberately two actions (spec §3): approving is the
// reviewer's "these are correct" and freezes the scores; publishing is the
// separate, explicit step that makes them visible to parents.
export async function approveBatch(batchId: string): Promise<ActionResult> {
  const { schoolId, userId, access } = await requireSchoolAdmin();
  return toResult(async () => {
    const batch = await loadBatch(access, batchId);
    if (batch.status !== "SUBMITTED") throw new UserError(`This batch is ${batch.status.toLowerCase()} and can't be approved.`);

    const rows = await loadRows(schoolId, batch.id);
    if (rows.length === 0) throw new UserError("This batch has no results to approve.");
    if (rows.some((r) => r.status !== "SUBMITTED")) throw new UserError("Some records in this batch are no longer submitted. Refresh and try again.");

    // Final validation: what was accepted at entry must still hold now.
    const fields = templateFields(batch.template);
    const problems: { student: string; issue: EntryIssue }[] = [];
    for (const r of rows) {
      const v = validateStudentEntry(fields, pickAllowedData(fields, (r.data as Record<string, string>) ?? {}));
      const student = `${r.student.firstName} ${r.student.lastName}`;
      problems.push(...[...v.errors, ...v.missing].map((issue) => ({ student, issue })));
    }
    if (problems.length > 0) throw new UserError(summarizeIssues(`Can't approve — ${problems.length} problem(s) to fix first:`, problems));

    // A 3rd Term with an annual summary also needs its year to be computable
    // and a promotion decision for every student.
    const annual = await annualFor(schoolId, batch, rows);
    if (annual && annual.issues.length > 0) {
      throw new UserError(`Can't approve — the annual summary isn't ready (${annual.issues.length} issue(s)): ${describeIssues(annual)}`);
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.resultBatch.updateMany({ where: { id: batch.id, status: "SUBMITTED" }, data: { status: "APPROVED" } });
      if (claimed.count === 0) throw new UserError("This batch was just changed by someone else. Refresh and try again.");
      await tx.result.updateMany({ where: { batchId: batch.id, status: "SUBMITTED" }, data: { status: "APPROVED", approvedByUserId: userId, approvedAt: now } });
      await recordResultEvent(tx, {
        schoolId,
        batchId: batch.id,
        action: "APPROVED",
        actorUserId: userId,
        actorRole: "SCHOOL_ADMIN",
        templateVersionId: batch.templateVersionId,
        metadata: { students: rows.length },
      });
    }, TX_OPTIONS);

    revalidateWorkflowPaths(batch.id);
    return {};
  });
}

class AlreadyPublished extends Error {}

export async function publishBatch(batchId: string): Promise<ActionResult<{ alreadyPublished: boolean }>> {
  const { schoolId, userId, access } = await requireSchoolAdmin();
  return toResult(async () => {
    const batch = await loadBatch(access, batchId);
    let alreadyPublished = batch.status === "PUBLISHED";

    if (!alreadyPublished) {
      if (batch.status !== "APPROVED") throw new UserError("Approve this batch before publishing it.");

      const rows = await loadRows(schoolId, batch.id);
      if (rows.length === 0 || rows.some((r) => r.status !== "APPROVED")) {
        throw new UserError("Some records in this batch are no longer approved. Refresh and try again.");
      }

      const fields = templateFields(batch.template);
      const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true, slug: true, logoUrl: true, address: true, phone: true, supportEmail: true } });
      const prior = needsPriorRows(fields) ? await loadPriorPublished(batch.templateId, rows.map((r) => r.studentId)) : [];
      const finalData = computePublishData(
        rows.map((r) => ({ studentId: r.studentId, session: r.session, data: (r.data as Record<string, string>) ?? {} })),
        fields,
        prior,
      );

      // Recomputed now, not trusted from approval: a term or exception may
      // have changed in between.
      const annual = await annualFor(schoolId, batch, rows, finalData);
      if (annual && annual.issues.length > 0) {
        throw new UserError(`Can't publish — the annual summary isn't ready (${annual.issues.length} issue(s)): ${describeIssues(annual)}`);
      }

      const now = new Date();
      // A verification-code collision (1 in ~10^12) just retries with fresh codes.
      for (let attempt = 0; ; attempt++) {
        // Everything a snapshot needs is known before the transaction opens, so
        // the transaction itself is a handful of set-based statements rather
        // than two queries per student.
        const snapshots = rows.map((r, i) => {
          const verificationCode = generateVerificationCode();
          const payload = buildSnapshotPayload({
            school,
            student: {
              name: `${r.student.firstName} ${r.student.lastName}`,
              code: r.student.studentCode,
              className: batch.class.name,
              campusName: r.student.campus.name,
            },
            period: { session: r.session, term: r.term },
            template: { id: batch.templateId, name: batch.template.name, versionId: batch.templateVersionId, fields },
            data: finalData[i],
            annual: annual?.students[i]?.payload,
            publication: { version: 1, verificationCode, publishedAt: now },
          });
          return { row: r, index: i, verificationCode, payload };
        });

        try {
          await prisma.$transaction(async (tx) => {
            // Claiming the batch first also serialises two people publishing at once.
            const claimed = await tx.resultBatch.updateMany({ where: { id: batch.id, status: "APPROVED" }, data: { status: "PUBLISHED" } });
            if (claimed.count === 0) throw new AlreadyPublished();

            await tx.publishedResultSnapshot.createMany({
              data: snapshots.map((s) => ({
                schoolId,
                resultId: s.row.id,
                batchId: batch.id,
                studentId: s.row.studentId,
                version: 1,
                payload: s.payload as unknown as Prisma.InputJsonValue,
                checksum: snapshotChecksum(s.payload),
                verificationCode: s.verificationCode,
                templateVersionId: batch.templateVersionId,
                publishedByUserId: userId,
                publishedAt: now,
              })),
            });

            const at = Prisma.sql`${now.toISOString()}::timestamptz AT TIME ZONE 'UTC'`;
            await tx.$executeRaw`
              UPDATE "results" AS r SET "data" = v."data"::jsonb, "status" = 'PUBLISHED'::"ResultStatus", "publishedAt" = ${at}, "updatedAt" = ${at}
              FROM unnest(${rows.map((r) => r.id)}::text[], ${finalData.map((d) => JSON.stringify(d))}::text[]) AS v("id", "data")
              WHERE r."id" = v."id"`;

            await recordResultEvent(tx, {
              schoolId,
              batchId: batch.id,
              action: "PUBLISHED",
              actorUserId: userId,
              actorRole: "SCHOOL_ADMIN",
              templateVersionId: batch.templateVersionId,
              metadata: { students: rows.length, snapshotVersion: 1, ...(annual ? { annualSummary: true, weights: annual.settings.weights, policy: annual.settings.policy } : {}) },
            });
          }, TX_OPTIONS);
          break;
        } catch (err) {
          if (err instanceof AlreadyPublished) {
            alreadyPublished = true;
            break;
          }
          const codeClash = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && attempt < 2;
          if (!codeClash) throw err;
        }
      }
    }

    // Sent after the commit, and after the response: these are network calls
    // (one per guardian per channel) and a class of 100 used to keep the admin
    // waiting on them. Each is keyed by snapshot + channel, so repeating
    // Publish never messages anyone twice and only retries sends that failed;
    // a failure is recorded on its notification row, never lost.
    after(async () => {
      const snapshots = await prisma.publishedResultSnapshot.findMany({
        where: { batchId: batch.id, supersededAt: null },
        include: { student: true },
      });
      const sends = snapshots.flatMap((snap) => {
        const student = snap.student;
        const name = `${student.firstName} ${student.lastName}`;
        const tasks: (() => Promise<string>)[] = [];
        if (student.guardianPhone) {
          tasks.push(() =>
            createAndSendNotification({
              schoolId,
              studentId: student.id,
              channel: "SMS",
              event: "RESULT_PUBLISHED",
              recipient: student.guardianPhone!,
              message: `${name}'s result has been published. Log in or use the result lookup to view it.`,
              dedupeKey: `RESULT_PUBLISHED:${snap.id}:SMS`,
            }),
          );
        }
        if (student.guardianEmail) {
          tasks.push(() =>
            createAndSendNotification({
              schoolId,
              studentId: student.id,
              channel: "EMAIL",
              event: "RESULT_PUBLISHED",
              recipient: student.guardianEmail!,
              subject: `${name}'s result has been published`,
              message: `${name}'s result has been published. Log in to your parent account or use the result lookup to view it.`,
              dedupeKey: `RESULT_PUBLISHED:${snap.id}:EMAIL`,
            }),
          );
        }
        return tasks;
      });
      await runWithConcurrency(sends, 8);
      revalidatePath("/admin/notifications");
    });

    revalidateWorkflowPaths(batch.id);
    revalidatePath("/admin/notifications");
    return { alreadyPublished };
  });
}

export async function sendBackBatch(batchId: string, note: string): Promise<ActionResult> {
  const { schoolId, userId, access } = await requireSchoolAdmin();
  return toResult(async () => {
    const reason = note.trim();
    if (!reason) throw new UserError("A note is required when sending results back.");

    const batch = await loadBatch(access, batchId);
    if (batch.status !== "SUBMITTED" && batch.status !== "APPROVED") {
      throw new UserError(`This batch is ${batch.status.toLowerCase()} and can't be sent back.`);
    }

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.resultBatch.updateMany({ where: { id: batch.id, status: { in: ["SUBMITTED", "APPROVED"] } }, data: { status: "REJECTED" } });
      if (claimed.count === 0) throw new UserError("This batch was just changed by someone else. Refresh and try again.");
      await tx.result.updateMany({
        where: { batchId: batch.id, status: { in: ["SUBMITTED", "APPROVED"] } },
        data: { status: "REJECTED", rejectionNote: reason, approvedByUserId: null, approvedAt: null },
      });
      await recordResultEvent(tx, {
        schoolId,
        batchId: batch.id,
        action: "SENT_BACK",
        actorUserId: userId,
        actorRole: "SCHOOL_ADMIN",
        reason,
        templateVersionId: batch.templateVersionId,
      });
    }, TX_OPTIONS);

    revalidateWorkflowPaths(batch.id);
    return {};
  });
}

// Renders one student's result exactly as a parent will see it, using the same
// computation and snapshot builder that publishing uses (the code shows as
// PREVIEW and nothing is saved).
export async function previewBatchPayload(batchId: string, resultId: string): Promise<ActionResult<{ payload: SnapshotPayload }>> {
  const { schoolId, access } = await requireSchoolAdmin();
  return toResult(async () => {
    const batch = await loadBatch(access, batchId);
    if (batch.status !== "SUBMITTED" && batch.status !== "APPROVED") throw new UserError("Only batches awaiting publication can be previewed.");

    const rows = await loadRows(schoolId, batch.id);
    const index = rows.findIndex((r) => r.id === resultId);
    if (index < 0) throw new UserError("That result isn't part of this batch.");

    const fields = templateFields(batch.template);
    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true, slug: true, logoUrl: true, address: true, phone: true, supportEmail: true } });
    const prior = needsPriorRows(fields) ? await loadPriorPublished(batch.templateId, rows.map((r) => r.studentId)) : [];
    const finalData = computePublishData(
      rows.map((r) => ({ studentId: r.studentId, session: r.session, data: (r.data as Record<string, string>) ?? {} })),
      fields,
      prior,
    );

    const annual = await annualFor(schoolId, batch, rows, finalData);
    const r = rows[index];
    const payload = buildSnapshotPayload({
      school,
      student: { name: `${r.student.firstName} ${r.student.lastName}`, code: r.student.studentCode, className: batch.class.name, campusName: r.student.campus.name },
      period: { session: r.session, term: r.term },
      template: { id: batch.templateId, name: batch.template.name, versionId: batch.templateVersionId, fields },
      data: finalData[index],
      annual: annual?.students[index]?.payload,
      publication: { version: 1, verificationCode: "PREVIEW", publishedAt: new Date() },
    });
    return { payload };
  });
}

// What the review page shows for a 3rd Term annual batch: each student's
// earlier-term status, what's blocking approval, and their promotion decision.
export async function getBatchAnnualReview(batchId: string) {
  const { schoolId, access } = await requireSchoolAdmin();
  const batch = await loadBatch(access, batchId);
  const rows = await loadRows(schoolId, batch.id);
  const annual = await annualFor(schoolId, batch, rows);
  if (!annual) return null;
  return {
    weightsOk: annual.weightsOk,
    weights: annual.settings.weights,
    policy: annual.settings.policy,
    issues: annual.issues,
    students: annual.students.map((s, i) => ({
      studentId: s.studentId,
      resultId: s.resultId,
      name: s.studentName,
      termStates: s.termStates,
      blockers: s.blockers,
      annualAverage: s.payload?.overall.average ?? null,
      incomplete: s.payload?.incomplete ?? false,
      promotionStatus: rows[i].promotionStatus,
      promotedToClassId: rows[i].promotedToClassId,
    })),
  };
}

// A student who genuinely wasn't at the school (or was exempt) for an earlier
// term is marked here, not silently scored zero. Recorded in the audit trail.
export async function markTermException(input: {
  batchId: string;
  studentId: string;
  termNumber: number;
  status: "NOT_ENROLLED" | "EXEMPT";
  reason: string;
}): Promise<ActionResult> {
  const { schoolId, userId, access } = await requireSchoolAdmin();
  return toResult(async () => {
    const reason = input.reason.trim();
    if (!reason) throw new UserError("Give a reason — it's recorded in the audit trail.");
    if (input.termNumber !== 1 && input.termNumber !== 2) throw new UserError("Only the 1st or 2nd Term can be marked.");
    if (input.status !== "NOT_ENROLLED" && input.status !== "EXEMPT") throw new UserError("Unknown status.");

    const { batch, row } = await loadAnnualBatchRow(access, input.batchId, input.studentId);

    const published = await prisma.result.count({
      where: { schoolId, templateId: batch.templateId, session: batch.session, studentId: input.studentId, status: "PUBLISHED", batch: { termNumber: input.termNumber } },
    });
    if (published > 0) {
      throw new UserError(`${row.student.firstName} already has a published ${termLabel(input.termNumber)} result, so it can't be marked ${input.status === "EXEMPT" ? "exempt" : "not enrolled"}.`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.studentTermException.upsert({
        where: { studentId_session_termNumber: { studentId: input.studentId, session: batch.session, termNumber: input.termNumber } },
        create: { schoolId, studentId: input.studentId, session: batch.session, termNumber: input.termNumber, status: input.status, reason, createdByUserId: userId },
        update: { status: input.status, reason, createdByUserId: userId },
      });
      await recordResultEvent(tx, {
        schoolId,
        batchId: batch.id,
        resultId: row.id,
        action: "TERM_EXCEPTION_SET",
        actorUserId: userId,
        actorRole: "SCHOOL_ADMIN",
        reason,
        templateVersionId: batch.templateVersionId,
        metadata: { studentId: input.studentId, session: batch.session, termNumber: input.termNumber, status: input.status },
      });
    });

    revalidateWorkflowPaths(batch.id);
    return {};
  });
}

export async function clearTermException(input: { batchId: string; studentId: string; termNumber: number }): Promise<ActionResult> {
  const { schoolId, userId, access } = await requireSchoolAdmin();
  return toResult(async () => {
    if (!isTermNumber(input.termNumber) || input.termNumber === 3) throw new UserError("Only the 1st or 2nd Term can be cleared.");
    const { batch, row } = await loadAnnualBatchRow(access, input.batchId, input.studentId);

    const existing = await prisma.studentTermException.findUnique({
      where: { studentId_session_termNumber: { studentId: input.studentId, session: batch.session, termNumber: input.termNumber } },
    });
    if (!existing || existing.schoolId !== schoolId) return {};

    await prisma.$transaction(async (tx) => {
      await tx.studentTermException.delete({ where: { id: existing.id } });
      await recordResultEvent(tx, {
        schoolId,
        batchId: batch.id,
        resultId: row.id,
        action: "TERM_EXCEPTION_CLEARED",
        actorUserId: userId,
        actorRole: "SCHOOL_ADMIN",
        templateVersionId: batch.templateVersionId,
        metadata: { studentId: input.studentId, session: batch.session, termNumber: input.termNumber, previousStatus: existing.status },
      });
    });

    revalidateWorkflowPaths(batch.id);
    return {};
  });
}

// Term/promotion changes are only allowed while the batch is still open for
// review — approval freezes the scores, and publishing freezes everything.
async function loadAnnualBatchRow(access: AdminAccess, batchId: string, studentId: string) {
  const { schoolId } = access;
  const batch = await loadBatch(access, batchId);
  if (batch.status !== "SUBMITTED" && batch.status !== "APPROVED") throw new UserError(`This batch is ${batch.status.toLowerCase()} and can't be changed.`);
  if (!findAnnualGrid(templateFields(batch.template)) || (batch.termNumber ?? termNumberFromLabel(batch.term)) !== 3) {
    throw new UserError("This batch has no annual summary.");
  }
  const row = await prisma.result.findFirst({ where: { schoolId, batchId: batch.id, studentId }, include: { student: true } });
  if (!row) throw new UserError("That student isn't in this batch.");
  return { batch, row };
}

const PROMOTION_STATUSES = ["PROMOTED", "RETAINED", "GRADUATED", "PENDING", "NOT_APPLICABLE"] as const;

export async function setPromotion(input: {
  batchId: string;
  resultId: string;
  status: (typeof PROMOTION_STATUSES)[number];
  promotedToClassId: string | null;
}): Promise<ActionResult> {
  const { schoolId, access } = await requireSchoolAdmin();
  return toResult(async () => {
    if (!PROMOTION_STATUSES.includes(input.status)) throw new UserError("Unknown promotion status.");

    const batch = await loadBatch(access, input.batchId);
    if (batch.status !== "SUBMITTED") throw new UserError(`This batch is ${batch.status.toLowerCase()} — promotion decisions are made while it's under review.`);

    const row = await prisma.result.findFirst({ where: { id: input.resultId, schoolId, batchId: batch.id } });
    if (!row) throw new UserError("That result isn't part of this batch.");

    let promotedToClassId: string | null = null;
    if (input.status === "PROMOTED") {
      if (!input.promotedToClassId) throw new UserError("Choose the class the student is promoted to.");
      const target = await prisma.class.findFirst({ where: { id: input.promotedToClassId, schoolId, ...classWhere(access) }, select: { id: true } });
      if (!target) throw new UserError("That class doesn't exist in this school.");
      promotedToClassId = target.id;
    }

    await prisma.result.update({ where: { id: row.id }, data: { promotionStatus: input.status, promotedToClassId } });
    revalidatePath(`/admin/results/${batch.id}`);
    return {};
  });
}

function revalidateWorkflowPaths(batchId: string) {
  revalidatePath("/admin/results");
  revalidatePath(`/admin/results/${batchId}`);
  revalidatePath("/teacher/classes");
}
