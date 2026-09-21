"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type PromotionStatus } from "@prisma/client";
import { getAdminAccess, type AdminAccess } from "@/lib/admin-access";
import { classWhere, ofStudentWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { createAndSendNotification } from "@/lib/notifications";
import { computeOwnFields } from "@/lib/template-compute";
import { expandThisTermFields } from "@/lib/grid-compute";
import { recordResultEvent } from "@/lib/result-events";
import { keyLabels } from "@/lib/result-labels";
import { fieldsAsPublished } from "@/lib/published-fields";
import { buildSnapshotPayload, generateVerificationCode, snapshotChecksum, type SnapshotPayload } from "@/lib/snapshot";
import { allowedDataKeys, pickAllowedData, summarizeIssues, validateSingleValue, validateStudentEntry } from "@/lib/result-validate";
import { computeBatchAnnual, describeIssues } from "@/lib/annual-context";
import { findAnnualGrid, type AnnualSettings } from "@/lib/annual-summary";
import { termNumberFromLabel } from "@/lib/term-number";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";

// Amendments (spec §3, RT-12). A published result is never edited: a
// correction is a *new* snapshot (version + 1, new verification code) and the
// old one is marked superseded, so what a parent was once shown stays
// available to the school. Positions and other class-relative figures keep
// what they were when the batch was published — only this student's own
// totals, grades and remarks are recalculated, so one correction never
// changes another student's published result.

async function requireSchoolAdmin() {
  const access = await getAdminAccess();
  return { schoolId: access.schoolId, userId: access.userId, access };
}

const TX_OPTIONS = { timeout: 60_000, maxWait: 20_000 };
const PROMOTION_STATUSES = ["PROMOTED", "RETAINED", "GRADUATED", "PENDING", "NOT_APPLICABLE"] as const;
const CONFLICT = "This result was amended by someone else since you opened it. Reload the page to see the latest version, then try again.";

export type AmendInput = {
  resultId: string;
  // The snapshot the admin was looking at; a correction only applies to that version.
  basedOnSnapshotId: string;
  // Teacher-entered keys only (scores, their `#state` keys, flat fields).
  changes: Record<string, string>;
  promotion: { status: (typeof PROMOTION_STATUSES)[number]; promotedToClassId: string | null } | null;
  reason: string;
  notifyParents: boolean;
};

export type AmendChange = { key: string; label: string; from: string; to: string };

async function prepare(access: AdminAccess, input: AmendInput) {
  const { schoolId } = access;
  // A result of another campus's student isn't found, however it was reached.
  const result = await prisma.result.findFirst({
    where: { id: input.resultId, schoolId, ...ofStudentWhere(access) },
    include: { student: true, batch: { include: { template: true } } },
  });
  if (!result || !result.batch) throw new UserError("Result not found.");
  if (result.status !== "PUBLISHED") throw new UserError("Only a published result can be amended. Results still under review are corrected on the review page.");

  const current = await prisma.publishedResultSnapshot.findFirst({
    where: { resultId: result.id, supersededAt: null },
    orderBy: { version: "desc" },
  });
  if (!current) throw new UserError("This result has no current published version.");
  if (current.id !== input.basedOnSnapshotId) throw new UserError(CONFLICT);
  const previous = current.payload as unknown as SnapshotPayload;

  // Recompute with the template exactly as it was when this result was
  // published — a newer template version must not silently reshape it.
  const fields = await fieldsAsPublished(current.templateVersionId, result.batch.template.fields);

  const reason = input.reason.trim();
  if (reason.length < 5) throw new UserError("Give a reason for the correction (a short sentence). It is recorded in the audit trail.");

  const allowed = allowedDataKeys(fields);
  const before = (result.data as Record<string, string>) ?? {};
  const labels = keyLabels(fields);
  const changes: AmendChange[] = [];
  const merged: Record<string, string> = { ...before };
  for (const [key, raw] of Object.entries(input.changes)) {
    if (!allowed.has(key)) throw new UserError("One of the values isn't part of this result and can't be edited.");
    const value = typeof raw === "string" ? raw.trim() : "";
    const problem = validateSingleValue(fields, key, value);
    if (problem) throw new UserError(`${labels.get(key) ?? key}: ${problem}`);
    if ((before[key] ?? "") !== value) {
      changes.push({ key, label: labels.get(key) ?? key, from: before[key] ?? "", to: value });
      merged[key] = value;
    }
  }

  const entry = validateStudentEntry(fields, pickAllowedData(fields, merged));
  const problems = [...entry.errors, ...entry.missing].map((issue) => ({ student: `${result.student.firstName} ${result.student.lastName}`, issue }));
  if (problems.length > 0) throw new UserError(summarizeIssues("This correction isn't valid:", problems));

  // Own totals/grades/remarks; batch-relative fields (positions) are left as published.
  const data = computeOwnFields(expandThisTermFields(fields), merged);

  // Promotion (only on an annual Term 3 result).
  let promotionStatus: PromotionStatus | null = result.promotionStatus;
  let promotedToClassId: string | null = result.promotedToClassId;
  let promotionChanged = false;
  if (input.promotion) {
    if (!PROMOTION_STATUSES.includes(input.promotion.status)) throw new UserError("Unknown promotion status.");
    let target: string | null = null;
    if (input.promotion.status === "PROMOTED") {
      if (!input.promotion.promotedToClassId) throw new UserError("Choose the class the student is promoted to.");
      const klass = await prisma.class.findFirst({ where: { id: input.promotion.promotedToClassId, schoolId, ...classWhere(access) }, select: { id: true } });
      if (!klass) throw new UserError("That class doesn't exist in this school.");
      target = klass.id;
    }
    promotionChanged = promotionStatus !== input.promotion.status || promotedToClassId !== target;
    promotionStatus = input.promotion.status;
    promotedToClassId = target;
  }
  if (changes.length === 0 && !promotionChanged) throw new UserError("Nothing was changed.");

  // Annual summary: recomputed with the weights and policy this result was
  // published with; the year's position stays as published.
  let annual = undefined as SnapshotPayload["annual"];
  const termNumber = result.batch.termNumber ?? termNumberFromLabel(result.batch.term);
  if (findAnnualGrid(fields) && termNumber === 3) {
    const frozen = previous.annual;
    const settings: AnnualSettings | undefined = frozen
      ? { weights: { 1: frozen.weights.t1, 2: frozen.weights.t2, 3: frozen.weights.t3 }, policy: frozen.policy, showPosition: frozen.position !== null }
      : undefined;
    const computed = await computeBatchAnnual({
      schoolId,
      batch: { id: result.batch.id, templateId: result.batch.templateId, session: result.batch.session, termNumber },
      fields,
      settingsOverride: settings,
      rows: [{ id: result.id, studentId: result.studentId, studentName: `${result.student.firstName} ${result.student.lastName}`, data, promotionStatus, promotedToClassId }],
    });
    const only = computed?.students[0];
    if (!only?.payload || computed!.issues.length > 0) {
      throw new UserError(`The annual summary can't be recalculated: ${computed ? describeIssues(computed) : "not available"}.`);
    }
    annual = { ...only.payload, position: frozen?.position ?? null };
  }

  return { result, current, previous, fields, data, changes, annual, reason, promotionStatus, promotedToClassId, promotionChanged };
}

function payloadFor(p: Awaited<ReturnType<typeof prepare>>, publication: { version: number; verificationCode: string; amendedAt: Date }) {
  return buildSnapshotPayload({
    school: p.previous.school,
    student: p.previous.student, // as first published — the class the result belongs to, not where the student is now
    period: p.previous.period,
    template: { id: p.previous.template.id, name: p.previous.template.name, versionId: p.previous.template.versionId, fields: p.fields },
    data: p.data,
    annual: p.annual,
    publication: { ...publication, publishedAt: new Date(p.previous.publication.publishedAt) },
  });
}

// Exactly what parents will see, computed by the same code the correction
// uses — nothing is saved.
export async function previewAmendment(input: AmendInput): Promise<ActionResult<{ payload: SnapshotPayload; changes: AmendChange[] }>> {
  const { access } = await requireSchoolAdmin();
  return toResult(async () => {
    const p = await prepare(access, input);
    const payload = payloadFor(p, { version: p.current.version + 1, verificationCode: "PREVIEW", amendedAt: new Date() });
    return { payload, changes: p.changes };
  });
}

class Superseded extends Error {}

export async function amendResult(input: AmendInput): Promise<ActionResult<{ snapshotId: string; version: number }>> {
  const { schoolId, userId, access } = await requireSchoolAdmin();
  return toResult(async () => {
    const p = await prepare(access, input);
    const version = p.current.version + 1;
    const now = new Date();

    let created: { id: string } | null = null;
    // A verification-code collision (1 in ~10^12) just retries with a fresh code.
    for (let attempt = 0; ; attempt++) {
      const verificationCode = generateVerificationCode();
      const payload = payloadFor(p, { version, verificationCode, amendedAt: now });
      try {
        created = await prisma.$transaction(async (tx) => {
          // Claiming the current snapshot first serialises two people amending at once.
          const claimed = await tx.publishedResultSnapshot.updateMany({ where: { id: p.current.id, supersededAt: null }, data: { supersededAt: now } });
          if (claimed.count === 0) throw new Superseded();

          const snapshot = await tx.publishedResultSnapshot.create({
            data: {
              schoolId,
              resultId: p.result.id,
              batchId: p.result.batchId,
              studentId: p.result.studentId,
              version,
              payload: payload as unknown as Prisma.InputJsonValue,
              checksum: snapshotChecksum(payload),
              verificationCode,
              templateVersionId: p.current.templateVersionId,
              publishedByUserId: userId,
              // Kept at the original publication date so the correction doesn't
              // jump ahead of later terms in a parent's list; `createdAt` and the
              // audit event carry the real time.
              publishedAt: new Date(p.previous.publication.publishedAt),
              amendmentReason: p.reason,
              amendedByUserId: userId,
              supersedesSnapshotId: p.current.id,
            },
          });
          await tx.result.update({
            where: { id: p.result.id },
            data: { data: p.data, revision: { increment: 1 }, promotionStatus: p.promotionStatus, promotedToClassId: p.promotedToClassId },
          });
          await recordResultEvent(tx, {
            schoolId,
            batchId: p.result.batchId!,
            resultId: p.result.id,
            action: "AMENDED",
            actorUserId: userId,
            actorRole: "SCHOOL_ADMIN",
            reason: p.reason,
            templateVersionId: p.current.templateVersionId,
            metadata: {
              studentId: p.result.studentId,
              version,
              previousSnapshotId: p.current.id,
              newSnapshotId: snapshot.id,
              changes: p.changes,
              ...(p.promotionChanged ? { promotion: { status: p.promotionStatus, promotedToClassId: p.promotedToClassId } } : {}),
              positionsKept: true,
            },
          });
          return snapshot;
        }, TX_OPTIONS);
        break;
      } catch (err) {
        if (err instanceof Superseded) throw new UserError(CONFLICT);
        const codeClash = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && attempt < 2;
        if (!codeClash) throw err;
      }
    }

    // After the commit (network calls stay out of the transaction); keyed by
    // snapshot + channel, so repeating never messages anyone twice.
    if (input.notifyParents) {
      const student = p.result.student;
      const name = `${student.firstName} ${student.lastName}`;
      const term = p.previous.period.term;
      const sends: Promise<string>[] = [];
      if (student.guardianPhone) {
        sends.push(
          createAndSendNotification({
            schoolId,
            studentId: student.id,
            channel: "SMS",
            event: "RESULT_AMENDED",
            recipient: student.guardianPhone,
            message: `${name}'s ${term} result has been corrected. Log in or use the result lookup to view the updated version.`,
            dedupeKey: `RESULT_AMENDED:${created!.id}:SMS`,
          }),
        );
      }
      if (student.guardianEmail) {
        sends.push(
          createAndSendNotification({
            schoolId,
            studentId: student.id,
            channel: "EMAIL",
            event: "RESULT_AMENDED",
            recipient: student.guardianEmail,
            subject: `${name}'s ${term} result has been corrected`,
            message: `${name}'s ${term} result has been corrected. Log in to your parent account or use the result lookup to view the updated version.`,
            dedupeKey: `RESULT_AMENDED:${created!.id}:EMAIL`,
          }),
        );
      }
      await Promise.all(sends);
    }

    revalidatePath("/admin/published");
    revalidatePath(`/admin/published/${p.result.batchId}`);
    revalidatePath("/admin/audit");
    revalidatePath("/admin/notifications");
    revalidatePath("/parent/dashboard");
    return { snapshotId: created!.id, version };
  });
}
