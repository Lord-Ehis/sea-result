"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forgetSchoolAccess } from "@/lib/school-access-lookup";
import { defaultSessionLabel } from "@/lib/academic-term";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";

async function requirePlatformOwner() {
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") throw new Error("Not authorized.");
  return session.user.id;
}

export async function setSchoolStatus(schoolId: string, status: "ACTIVE" | "SUSPENDED") {
  await requirePlatformOwner();
  await prisma.school.update({ where: { id: schoolId }, data: { status } });
  forgetSchoolAccess(schoolId); // this instance sees the change at once; others within seconds
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

// Access without a payment: recorded as a zero-amount "complimentary"
// subscription so it appears in the school's history and lapses like any other.
export async function grantComplimentaryAccess(input: { schoolId: string; until: string; note: string }): Promise<ActionResult> {
  const ownerId = await requirePlatformOwner();
  return toResult(async () => {
    const note = input.note.trim();
    if (!note) throw new UserError("Give a reason — it's kept in the school's subscription history.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.until)) throw new UserError("Choose the date access should run until.");
    const end = new Date(`${input.until}T23:59:59.999Z`);
    if (Number.isNaN(end.getTime()) || end.getTime() <= Date.now()) throw new UserError("That date has already passed.");

    const school = await prisma.school.findUnique({ where: { id: input.schoolId }, select: { id: true } });
    if (!school) throw new UserError("School not found.");

    await prisma.subscription.create({
      data: {
        schoolId: school.id,
        billingCycle: "FULL_SESSION",
        session: defaultSessionLabel(),
        amount: 0,
        discountNote: `Complimentary access: ${note} (granted by platform owner ${ownerId})`,
        isComplimentary: true,
        status: "ACTIVE",
        startDate: new Date(),
        endDate: end,
      },
    });
    forgetSchoolAccess(school.id);
    revalidatePath(`/owner/schools/${school.id}`);
    revalidatePath("/owner/schools");
    return {};
  });
}
