"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAndSendNotification } from "@/lib/notifications";

async function requireSchoolAdmin() {
  const session = await auth();
  if (!session?.user.schoolId || session.user.role !== "SCHOOL_ADMIN") {
    throw new Error("Not authorized.");
  }
  return { schoolId: session.user.schoolId, userId: session.user.id };
}

export async function updateResultValue(resultId: string, fieldId: string, value: string) {
  const { schoolId } = await requireSchoolAdmin();
  const result = await prisma.result.findFirst({ where: { id: resultId, schoolId } });
  if (!result) throw new Error("Result not found.");

  const data = { ...((result.data as Record<string, string>) ?? {}), [fieldId]: value };
  await prisma.result.update({ where: { id: resultId }, data: { data } });
}

export async function publishBatch(templateId: string) {
  const { schoolId, userId } = await requireSchoolAdmin();

  const rows = await prisma.result.findMany({
    where: { schoolId, templateId, status: "SUBMITTED" },
    include: { student: true },
  });
  if (rows.length === 0) throw new Error("Nothing to publish.");

  const now = new Date();
  await prisma.result.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { status: "PUBLISHED", approvedByUserId: userId, approvedAt: now, publishedAt: now },
  });

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
