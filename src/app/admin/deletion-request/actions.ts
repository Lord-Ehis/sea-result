"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFullAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

// School-wide setting: a campus admin is refused (see src/lib/admin-access.ts).
async function requireSchoolAdmin() {
  const { schoolId, userId } = await requireFullAdmin();
  return { schoolId, userId };
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
