"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAndSendNotification } from "@/lib/notifications";
import { computeOwnFields, computePositions, aggregateCumulative } from "@/lib/template-compute";
import type { TemplateField } from "@/app/admin/result-templates/actions";

async function requireSchoolAdmin() {
  const session = await auth();
  if (!session?.user.schoolId || session.user.role !== "SCHOOL_ADMIN") {
    throw new Error("Not authorized.");
  }
  return { schoolId: session.user.schoolId, userId: session.user.id };
}

export async function updateResultValue(resultId: string, fieldId: string, value: string) {
  const { schoolId } = await requireSchoolAdmin();
  const result = await prisma.result.findFirst({ where: { id: resultId, schoolId }, include: { template: true } });
  if (!result) throw new Error("Result not found.");

  const fields = Array.isArray(result.template.fields) ? (result.template.fields as unknown as TemplateField[]) : [];
  const raw = { ...((result.data as Record<string, string>) ?? {}), [fieldId]: value };
  const data = computeOwnFields(fields, raw);
  await prisma.result.update({ where: { id: resultId }, data: { data } });
}

export async function publishBatch(templateId: string) {
  const { schoolId, userId } = await requireSchoolAdmin();

  const [template, rows] = await Promise.all([
    prisma.resultTemplate.findFirst({ where: { id: templateId, schoolId } }),
    prisma.result.findMany({
      where: { schoolId, templateId, status: "SUBMITTED" },
      include: { student: true },
    }),
  ]);
  if (rows.length === 0) throw new Error("Nothing to publish.");

  const fields = Array.isArray(template?.fields) ? (template.fields as unknown as TemplateField[]) : [];
  const ownComputed = rows.map((r) => computeOwnFields(fields, (r.data as Record<string, string>) ?? {}));

  // Cumulative fields need each student's own prior published rows for this
  // same template — only meaningful if the school reuses one template
  // across a session's terms rather than creating a new one each time.
  const cumulativeFields = fields.filter((f) => f.type === "Computed" && f.formula?.kind === "cumulative");
  let afterCumulative = ownComputed;
  if (cumulativeFields.length > 0) {
    const priorRows = await prisma.result.findMany({
      where: { templateId, status: "PUBLISHED", studentId: { in: rows.map((r) => r.studentId) } },
    });

    afterCumulative = rows.map((r, i) => {
      const data = { ...ownComputed[i] };
      const priorForStudent = priorRows.filter((p) => p.studentId === r.studentId && p.session === r.session);
      for (const field of cumulativeFields) {
        const formula = field.formula;
        if (formula?.kind !== "cumulative") continue;
        const values = [
          ...priorForStudent.map((p) => Number((p.data as Record<string, string>)?.[formula.of])),
          Number(ownComputed[i][formula.of]),
        ].filter((v) => Number.isFinite(v));
        data[field.id] = aggregateCumulative(formula.aggregate, values);
      }
      return data;
    });

    // Lets a grade-kind field whose `of` points at a cumulative field
    // compute now that the cumulative value actually exists.
    afterCumulative = afterCumulative.map((d) => computeOwnFields(fields, d));
  }

  const finalData = computePositions(fields, afterCumulative);

  const now = new Date();
  await prisma.$transaction(
    rows.map((r, i) =>
      prisma.result.update({
        where: { id: r.id },
        data: { data: finalData[i], status: "PUBLISHED", approvedByUserId: userId, approvedAt: now, publishedAt: now },
      }),
    ),
  );

  // Sent after the DB update commits — these are network calls and don't
  // belong inside the transaction. Each notification records its own
  // SENT/FAILED outcome, so one bad recipient doesn't block the rest.
  await Promise.all(
    rows.flatMap((r) => {
      const studentName = `${r.student.firstName} ${r.student.lastName}`;
      const sends: Promise<string>[] = [];
      if (r.student.guardianPhone) {
        sends.push(
          createAndSendNotification({
            schoolId,
            studentId: r.studentId,
            channel: "SMS",
            event: "RESULT_PUBLISHED",
            recipient: r.student.guardianPhone,
            message: `${studentName}'s result has been published. Log in or use the result lookup to view it.`,
          }),
        );
      }
      if (r.student.guardianEmail) {
        sends.push(
          createAndSendNotification({
            schoolId,
            studentId: r.studentId,
            channel: "EMAIL",
            event: "RESULT_PUBLISHED",
            recipient: r.student.guardianEmail,
            subject: `${studentName}'s result has been published`,
            message: `${studentName}'s result has been published. Log in to your parent account or use the result lookup to view it.`,
          }),
        );
      }
      return sends;
    }),
  );

  revalidatePath("/admin/results");
  revalidatePath(`/admin/results/${templateId}`);
  revalidatePath("/admin/notifications");
}

export async function sendBackBatch(templateId: string, note: string) {
  const { schoolId, userId } = await requireSchoolAdmin();
  if (!note.trim()) throw new Error("A note is required when sending results back.");

  await prisma.result.updateMany({
    where: { schoolId, templateId, status: "SUBMITTED" },
    data: { status: "REJECTED", rejectionNote: note.trim(), approvedByUserId: userId, approvedAt: new Date() },
  });

  revalidatePath("/admin/results");
  revalidatePath(`/admin/results/${templateId}`);
}
