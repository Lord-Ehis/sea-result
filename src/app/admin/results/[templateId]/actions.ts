"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  await prisma.$transaction([
    prisma.result.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { status: "PUBLISHED", approvedByUserId: userId, approvedAt: now, publishedAt: now },
    }),
    ...rows
      .filter((r) => r.student.guardianPhone)
      .map((r) =>
        prisma.notification.create({
          data: {
            schoolId,
            studentId: r.studentId,
            channel: "SMS",
            event: "RESULT_PUBLISHED",
            recipient: r.student.guardianPhone!,
            message: `${r.student.firstName} ${r.student.lastName}'s result has been published. Log in or use the result lookup to view it.`,
            status: "PENDING",
          },
        }),
      ),
  ]);

  revalidatePath("/admin/results");
  revalidatePath(`/admin/results/${templateId}`);
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
