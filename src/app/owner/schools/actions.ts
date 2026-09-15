"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requirePlatformOwner() {
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") throw new Error("Not authorized.");
  return session.user.id;
}

export async function setSchoolStatus(schoolId: string, status: "ACTIVE" | "SUSPENDED") {
  await requirePlatformOwner();
  await prisma.school.update({ where: { id: schoolId }, data: { status } });
  revalidatePath("/owner/schools");
  revalidatePath(`/owner/schools/${schoolId}`);
}

export async function resolveDeletionRequest(requestId: string, decision: "APPROVED" | "REJECTED", note: string) {
  const ownerId = await requirePlatformOwner();
  if (decision === "REJECTED" && !note.trim()) throw new Error("A note is required when declining a deletion request.");

  const request = await prisma.deletionRequest.findFirst({ where: { id: requestId, status: "PENDING" } });
  if (!request) throw new Error("This request was not found or has already been resolved.");

  await prisma.$transaction([
    prisma.deletionRequest.update({
      where: { id: request.id },
      data: { status: decision, resolvedByUserId: ownerId, resolvedAt: new Date(), resolutionNote: note.trim() || null },
    }),
    // Rejecting restores normal access. Approving leaves the school on
    // PENDING_DELETION — actual data removal is a separate, manual step.
    ...(decision === "REJECTED"
      ? [prisma.school.update({ where: { id: request.schoolId }, data: { status: "ACTIVE" as const } })]
      : []),
  ]);

  revalidatePath(`/owner/schools/${request.schoolId}`);
  revalidatePath("/owner/schools");
}
