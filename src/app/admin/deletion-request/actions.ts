"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireSchoolAdmin() {
  const session = await auth();
  if (!session?.user.schoolId || session.user.role !== "SCHOOL_ADMIN") {
    throw new Error("Not authorized.");
  }
  return { schoolId: session.user.schoolId, userId: session.user.id };
}

const reasonSchema = z.object({
  reason: z.string().trim().min(10, "Please provide a bit more detail (at least 10 characters)"),
});

export async function requestDeletion(reason: string) {
  const { schoolId, userId } = await requireSchoolAdmin();
  const parsed = reasonSchema.parse({ reason });

  const existing = await prisma.deletionRequest.findFirst({ where: { schoolId, status: "PENDING" } });
  if (existing) throw new Error("A deletion request is already pending review.");

  await prisma.$transaction([
    prisma.deletionRequest.create({ data: { schoolId, requestedByUserId: userId, reason: parsed.reason } }),
    prisma.school.update({ where: { id: schoolId }, data: { status: "PENDING_DELETION" } }),
  ]);

  revalidatePath("/admin/deletion-request");
}

export async function cancelDeletionRequest(requestId: string) {
  const { schoolId } = await requireSchoolAdmin();
  const request = await prisma.deletionRequest.findFirst({ where: { id: requestId, schoolId, status: "PENDING" } });
  if (!request) throw new Error("Request not found.");

  await prisma.$transaction([
    prisma.deletionRequest.delete({ where: { id: request.id } }),
    prisma.school.update({ where: { id: schoolId }, data: { status: "ACTIVE" } }),
  ]);

  revalidatePath("/admin/deletion-request");
}
