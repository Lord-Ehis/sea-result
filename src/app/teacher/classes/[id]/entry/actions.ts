"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeOwnFields } from "@/lib/template-compute";
import { expandThisTermFields } from "@/lib/grid-compute";
import { pickAllowedData, validateStudentEntry, type EntryIssue } from "@/lib/result-validate";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";
import type { TemplateField } from "@/app/admin/result-templates/actions";

async function requireTeacherForClass(classId: string) {
  const session = await auth();
  if (!session?.user.schoolId || session.user.role !== "TEACHER") {
    throw new Error("Not authorized.");
  }
  const assignment = await prisma.teacherClassAssignment.findFirst({
    where: { teacherId: session.user.id, classId },
  });
  if (!assignment) throw new Error("You are not assigned to this class.");
  return { id: session.user.id, schoolId: session.user.schoolId };
}

const CONFLICT_MESSAGE =
  "These results were changed by someone else since you opened them. Reload the page to see the latest, then re-apply your changes.";

function summarize(prefix: string, issues: { student: string; issue: EntryIssue }[]): string {
  const shown = issues
    .slice(0, 5)
    .map(({ student, issue }) => `${student} — ${issue.label}: ${issue.message}`)
    .join("; ");
  const more = issues.length > 5 ? ` (and ${issues.length - 5} more)` : "";
  return `${prefix} ${shown}${more}`;
}

export type SaveClassResultsResult = {
  status: "DRAFT" | "SUBMITTED";
  // The new revision of every saved student record — the client sends these
  // back on its next save so stale edits are detected.
  revisions: Record<string, number>;
};

type SaveInput = {
  classId: string;
  templateId: string;
  term: string;
  session: string;
  entries: { studentId: string; data: Record<string, string>; revision: number | null }[];
  submit: boolean;
};

// Failures a teacher can act on come back as `{ ok: false, error }` — see user-error.ts.
export async function saveClassResults(input: SaveInput): Promise<ActionResult<SaveClassResultsResult>> {
  return toResult(() => saveClassResultsImpl(input));
}

async function saveClassResultsImpl(input: SaveInput): Promise<SaveClassResultsResult> {
  const user = await requireTeacherForClass(input.classId);

  const klass = await prisma.class.findFirst({
    where: { id: input.classId, schoolId: user.schoolId },
    include: { students: { select: { id: true, firstName: true, lastName: true } } },
  });
  if (!klass) throw new UserError("Class not found.");

  const template = await prisma.resultTemplate.findFirst({ where: { id: input.templateId, schoolId: user.schoolId } });
  if (!template) throw new UserError("Result template not found.");
  if (template.term !== input.term || klass.session !== input.session) {
    throw new UserError("This result sheet has changed since you opened it. Reload the page and try again.");
  }

  const fields = Array.isArray(template.fields) ? (template.fields as unknown as TemplateField[]) : [];
  const expandedFields = expandThisTermFields(fields);
  const studentName = new Map(klass.students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));

  for (const entry of input.entries) {
    if (!studentName.has(entry.studentId)) throw new UserError("A student in this submission isn't in this class.");
  }

  // Locking is enforced here, not just in the UI: only records that don't
  // exist yet, or are still a draft / sent back, may be written.
  const existing = await prisma.result.findMany({
    where: { templateId: template.id, term: input.term, session: input.session, studentId: { in: input.entries.map((e) => e.studentId) } },
  });
  const existingByStudent = new Map(existing.map((r) => [r.studentId, r]));
  for (const entry of input.entries) {
    const row = existingByStudent.get(entry.studentId);
    if (row && row.status !== "DRAFT" && row.status !== "REJECTED") {
      throw new UserError(`${studentName.get(entry.studentId)}'s result is ${row.status.toLowerCase()} and can no longer be edited.`);
    }
  }

  const cleaned = input.entries.map((e) => ({ ...e, data: pickAllowedData(fields, e.data) }));

  const errors: { student: string; issue: EntryIssue }[] = [];
  const missing: { student: string; issue: EntryIssue }[] = [];
  for (const entry of cleaned) {
    const result = validateStudentEntry(fields, entry.data);
    const student = studentName.get(entry.studentId)!;
    errors.push(...result.errors.map((issue) => ({ student, issue })));
    missing.push(...result.missing.map((issue) => ({ student, issue })));
  }
  if (errors.length > 0) throw new UserError(summarize(`Fix ${errors.length} score(s) before saving:`, errors));

  if (input.submit) {
    const covered = new Set(cleaned.map((e) => e.studentId));
    const absent = klass.students.filter((s) => !covered.has(s.id));
    if (absent.length > 0) {
      throw new UserError(`Every student must be included to submit. Missing: ${absent.map((s) => `${s.firstName} ${s.lastName}`).join(", ")}.`);
    }
    if (missing.length > 0) throw new UserError(summarize(`${missing.length} score(s) are still missing:`, missing));
  }

  const now = new Date();
  const revisions: Record<string, number> = {};

  try {
    await prisma.$transaction(
      async (tx) => {
        const batch = await tx.resultBatch.upsert({
          where: {
            classId_templateId_term_session: { classId: klass.id, templateId: template.id, term: input.term, session: input.session },
          },
          create: {
            schoolId: user.schoolId,
            classId: klass.id,
            templateId: template.id,
            templateVersionId: template.currentVersionId,
            term: input.term,
            session: input.session,
            status: input.submit ? "SUBMITTED" : "DRAFT",
            createdByUserId: user.id,
            submittedByUserId: input.submit ? user.id : null,
            submittedAt: input.submit ? now : null,
          },
          update: {
            status: input.submit ? "SUBMITTED" : "DRAFT",
            submittedByUserId: input.submit ? user.id : undefined,
            submittedAt: input.submit ? now : undefined,
            revision: { increment: 1 },
          },
        });

        for (const entry of cleaned) {
          const row = existingByStudent.get(entry.studentId);
          const data = computeOwnFields(expandedFields, entry.data);
          const status = input.submit ? "SUBMITTED" : "DRAFT";

          if (row) {
            if (entry.revision !== row.revision) throw new UserError(CONFLICT_MESSAGE);
            const updated = await tx.result.updateMany({
              where: { id: row.id, revision: row.revision },
              data: {
                data,
                status,
                batchId: batch.id,
                submittedByUserId: user.id,
                submittedAt: input.submit ? now : undefined,
                rejectionNote: input.submit ? null : undefined,
                revision: { increment: 1 },
              },
            });
            if (updated.count === 0) throw new UserError(CONFLICT_MESSAGE);
            revisions[entry.studentId] = row.revision + 1;
          } else {
            if (entry.revision !== null) throw new UserError(CONFLICT_MESSAGE);
            await tx.result.create({
              data: {
                schoolId: user.schoolId,
                studentId: entry.studentId,
                templateId: template.id,
                term: input.term,
                session: input.session,
                data,
                status,
                batchId: batch.id,
                submittedByUserId: user.id,
                submittedAt: input.submit ? now : null,
              },
            });
            revisions[entry.studentId] = 0;
          }
        }
      },
      // Each write is a network round trip; a whole class can outlast Prisma's 5s default.
      { timeout: 60_000, maxWait: 20_000 },
    );
  } catch (err) {
    // Two people creating the same student's record at once trips the unique key.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new UserError(CONFLICT_MESSAGE);
    throw err;
  }

  revalidatePath(`/teacher/classes/${input.classId}/entry`);
  revalidatePath("/teacher/classes");
  return { status: input.submit ? "SUBMITTED" : "DRAFT", revisions };
}
