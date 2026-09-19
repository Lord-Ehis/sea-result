"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAndSendNotification } from "@/lib/notifications";
import { computeOwnFields } from "@/lib/template-compute";
import { expandThisTermFields } from "@/lib/grid-compute";
import { computePublishData, needsPriorRows, type PriorPublishedRow } from "@/lib/publish-compute";
import { recordResultEvent } from "@/lib/result-events";
import { buildSnapshotPayload, generateVerificationCode, snapshotChecksum, type SnapshotPayload } from "@/lib/snapshot";
import { pickAllowedData, summarizeIssues, validateSingleValue, validateStudentEntry, type EntryIssue } from "@/lib/result-validate";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";
import type { TemplateField } from "@/app/admin/result-templates/actions";

async function requireSchoolAdmin() {
  const session = await auth();
  if (!session?.user.schoolId || session.user.role !== "SCHOOL_ADMIN") {
    throw new Error("Not authorized.");
  }
  return { schoolId: session.user.schoolId, userId: session.user.id };
}

const TX_OPTIONS = { timeout: 120_000, maxWait: 20_000 };

async function loadBatch(schoolId: string, batchId: string) {
  const batch = await prisma.resultBatch.findFirst({ where: { id: batchId, schoolId }, include: { class: true, template: true } });
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

async function loadPriorPublished(templateId: string, studentIds: string[]): Promise<PriorPublishedRow[]> {
  const prior = await prisma.result.findMany({ where: { templateId, status: "PUBLISHED", studentId: { in: studentIds } } });
  return prior.map((p) => ({ studentId: p.studentId, session: p.session, publishedAt: p.publishedAt, data: (p.data as Record<string, string>) ?? {} }));
}

// Corrections during review. Problems the admin can act on come back as
// `{ ok: false, error }` (see user-error.ts) so the message survives production.
export async function updateResultValue(resultId: string, fieldId: string, value: string): Promise<ActionResult> {
  const { schoolId } = await requireSchoolAdmin();
  return toResult(async () => {
    const result = await prisma.result.findFirst({ where: { id: resultId, schoolId }, include: { template: true } });
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
  const { schoolId, userId } = await requireSchoolAdmin();
  return toResult(async () => {
    const batch = await loadBatch(schoolId, batchId);
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
  const { schoolId, userId } = await requireSchoolAdmin();
  return toResult(async () => {
    const batch = await loadBatch(schoolId, batchId);
    let alreadyPublished = batch.status === "PUBLISHED";

    if (!alreadyPublished) {
      if (batch.status !== "APPROVED") throw new UserError("Approve this batch before publishing it.");

      const rows = await loadRows(schoolId, batch.id);
      if (rows.length === 0 || rows.some((r) => r.status !== "APPROVED")) {
        throw new UserError("Some records in this batch are no longer approved. Refresh and try again.");
      }

      const fields = templateFields(batch.template);
      const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true, slug: true } });
      const prior = needsPriorRows(fields) ? await loadPriorPublished(batch.templateId, rows.map((r) => r.studentId)) : [];
      const finalData = computePublishData(
        rows.map((r) => ({ studentId: r.studentId, session: r.session, data: (r.data as Record<string, string>) ?? {} })),
        fields,
        prior,
      );

      const now = new Date();
      // A verification-code collision (1 in ~10^12) just retries with fresh codes.
      for (let attempt = 0; ; attempt++) {
        try {
          await prisma.$transaction(async (tx) => {
            // Claiming the batch first also serialises two people publishing at once.
            const claimed = await tx.resultBatch.updateMany({ where: { id: batch.id, status: "APPROVED" }, data: { status: "PUBLISHED" } });
            if (claimed.count === 0) throw new AlreadyPublished();

            for (let i = 0; i < rows.length; i++) {
              const r = rows[i];
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
                publication: { version: 1, verificationCode, publishedAt: now },
              });
              await tx.result.update({ where: { id: r.id }, data: { data: finalData[i], status: "PUBLISHED", publishedAt: now } });
              await tx.publishedResultSnapshot.create({
                data: {
                  schoolId,
                  resultId: r.id,
                  batchId: batch.id,
                  studentId: r.studentId,
                  version: 1,
                  payload: payload as unknown as Prisma.InputJsonValue,
                  checksum: snapshotChecksum(payload),
                  verificationCode,
                  templateVersionId: batch.templateVersionId,
                  publishedByUserId: userId,
                  publishedAt: now,
                },
              });
            }

            await recordResultEvent(tx, {
              schoolId,
              batchId: batch.id,
              action: "PUBLISHED",
              actorUserId: userId,
              actorRole: "SCHOOL_ADMIN",
              templateVersionId: batch.templateVersionId,
              metadata: { students: rows.length, snapshotVersion: 1 },
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

    // Sent after the commit — these are network calls and don't belong in the
    // transaction. Each is keyed by snapshot + channel, so repeating Publish
    // never messages anyone twice and only retries sends that failed.
    const snapshots = await prisma.publishedResultSnapshot.findMany({
      where: { batchId: batch.id, supersededAt: null },
      include: { student: true },
    });
    await Promise.all(
      snapshots.flatMap((snap) => {
        const student = snap.student;
        const name = `${student.firstName} ${student.lastName}`;
        const sends: Promise<string>[] = [];
        if (student.guardianPhone) {
          sends.push(
            createAndSendNotification({
              schoolId,
              studentId: student.id,
              channel: "SMS",
              event: "RESULT_PUBLISHED",
              recipient: student.guardianPhone,
              message: `${name}'s result has been published. Log in or use the result lookup to view it.`,
              dedupeKey: `RESULT_PUBLISHED:${snap.id}:SMS`,
            }),
          );
        }
        if (student.guardianEmail) {
          sends.push(
            createAndSendNotification({
              schoolId,
              studentId: student.id,
              channel: "EMAIL",
              event: "RESULT_PUBLISHED",
              recipient: student.guardianEmail,
              subject: `${name}'s result has been published`,
              message: `${name}'s result has been published. Log in to your parent account or use the result lookup to view it.`,
              dedupeKey: `RESULT_PUBLISHED:${snap.id}:EMAIL`,
            }),
          );
        }
        return sends;
      }),
    );

    revalidateWorkflowPaths(batch.id);
    revalidatePath("/admin/notifications");
    return { alreadyPublished };
  });
}

export async function sendBackBatch(batchId: string, note: string): Promise<ActionResult> {
  const { schoolId, userId } = await requireSchoolAdmin();
  return toResult(async () => {
    const reason = note.trim();
    if (!reason) throw new UserError("A note is required when sending results back.");

    const batch = await loadBatch(schoolId, batchId);
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
  const { schoolId } = await requireSchoolAdmin();
  return toResult(async () => {
    const batch = await loadBatch(schoolId, batchId);
    if (batch.status !== "SUBMITTED" && batch.status !== "APPROVED") throw new UserError("Only batches awaiting publication can be previewed.");

    const rows = await loadRows(schoolId, batch.id);
    const index = rows.findIndex((r) => r.id === resultId);
    if (index < 0) throw new UserError("That result isn't part of this batch.");

    const fields = templateFields(batch.template);
    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true, slug: true } });
    const prior = needsPriorRows(fields) ? await loadPriorPublished(batch.templateId, rows.map((r) => r.studentId)) : [];
    const finalData = computePublishData(
      rows.map((r) => ({ studentId: r.studentId, session: r.session, data: (r.data as Record<string, string>) ?? {} })),
      fields,
      prior,
    );

    const r = rows[index];
    const payload = buildSnapshotPayload({
      school,
      student: { name: `${r.student.firstName} ${r.student.lastName}`, code: r.student.studentCode, className: batch.class.name, campusName: r.student.campus.name },
      period: { session: r.session, term: r.term },
      template: { id: batch.templateId, name: batch.template.name, versionId: batch.templateVersionId, fields },
      data: finalData[index],
      publication: { version: 1, verificationCode: "PREVIEW", publishedAt: new Date() },
    });
    return { payload };
  });
}

function revalidateWorkflowPaths(batchId: string) {
  revalidatePath("/admin/results");
  revalidatePath(`/admin/results/${batchId}`);
  revalidatePath("/teacher/classes");
}
