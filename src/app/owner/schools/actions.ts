"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forgetSchoolAccess } from "@/lib/school-access-lookup";
import { defaultSessionLabel } from "@/lib/academic-term";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";
import { changeUserEmail } from "@/lib/change-email";
import { recordPlatformEvent } from "@/lib/platform-events";
import { confirmOwnerIdentity } from "@/lib/owner-reauth";
import { countSchoolData, deleteSchoolRows, paidTotal } from "@/lib/school-data";
import { deleteSchoolFiles } from "@/lib/storage";

async function requirePlatformOwner() {
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") throw new Error("Not authorized.");
  return session.user.id;
}

export async function setSchoolStatus(schoolId: string, status: "ACTIVE" | "SUSPENDED") {
  const ownerId = await requirePlatformOwner();
  await prisma.$transaction(async (tx) => {
    const current = await tx.school.findUnique({ where: { id: schoolId }, select: { status: true } });
    if (!current) throw new Error("School not found.");
    await tx.school.update({ where: { id: schoolId }, data: { status } });
    // Only a real change is worth an audit entry (switching an active school "on" again is not one).
    if (current.status !== status) {
      await recordPlatformEvent(tx, { action: status === "SUSPENDED" ? "SCHOOL_SUSPENDED" : "SCHOOL_REACTIVATED", actorUserId: ownerId, schoolId });
    }
  });
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

// Recovery for a school administrator who has lost their inbox. The owner is
// expected to have confirmed who is asking (e.g. by phone) before using this.
export async function changeSchoolAdminEmail(input: { userId: string; email: string }): Promise<ActionResult<{ linkSent: boolean; email: string }>> {
  const ownerId = await requirePlatformOwner();
  return toResult(async () => {
    const admin = await prisma.user.findFirst({ where: { id: input.userId, role: "SCHOOL_ADMIN", schoolId: { not: null } }, select: { id: true, schoolId: true } });
    if (!admin?.schoolId) throw new UserError("Admin account not found.");
    const result = await changeUserEmail({
      targetUserId: admin.id,
      newEmail: input.email,
      actor: { userId: ownerId, role: "PLATFORM_OWNER", label: "the Sophie Educational Assistant team" },
    });
    revalidatePath(`/owner/schools/${admin.schoolId}`);
    return { linkSent: result.linkSent, email: result.newEmail };
  });
}

// Removes a school and everything it owns, for good. Only for a school that has
// already been switched off, so an active school can't be wiped by a stray
// click; needs the school's exact name, the owner's password and two-step code,
// and leaves a permanent line in the owner's audit log (which outlives the school).
export async function deleteSchoolData(input: { schoolId: string; confirmName: string; password: string; code: string }): Promise<ActionResult<{ filesRemoved: number | null; filesFailed: boolean }>> {
  const ownerId = await requirePlatformOwner();
  return toResult(async () => {
    const school = await prisma.school.findUnique({ where: { id: input.schoolId }, select: { id: true, name: true, status: true } });
    if (!school) throw new UserError("School not found. It may already have been deleted.");
    if (school.status === "ACTIVE") throw new UserError("Switch this school off first (Suspend), then delete it. An active school can't be deleted.");
    if (input.confirmName.trim() !== school.name) throw new UserError("The name you typed doesn't match the school's name exactly.");
    await confirmOwnerIdentity(ownerId, input.password, input.code);

    const counts = await countSchoolData(prisma, school.id);
    const paid = await paidTotal(prisma, school.id);

    await prisma.$transaction(
      async (tx) => {
        // Re-check inside the transaction: someone may have switched it back on since.
        const current = await tx.school.findUnique({ where: { id: school.id }, select: { status: true } });
        if (!current || current.status === "ACTIVE") throw new UserError("This school was switched back on. Nothing was deleted.");
        await deleteSchoolRows(tx, school.id);
        // The school's own id is not a foreign key here, so this line survives the deletion.
        await recordPlatformEvent(tx, { action: "SCHOOL_DATA_DELETED", actorUserId: ownerId, metadata: { deletedSchoolId: school.id, schoolName: school.name, counts, paidTotal: paid } });
      },
      { timeout: 120_000, maxWait: 10_000 },
    );

    // The database is the record that matters; stored files are cleaned up afterwards and a failure here is reported, not fatal.
    let filesRemoved: number | null = null;
    let filesFailed = false;
    try {
      filesRemoved = await deleteSchoolFiles(school.id);
    } catch (err) {
      filesFailed = true;
      console.error("could not delete a deleted school's stored files", err);
    }

    forgetSchoolAccess(school.id);
    // No revalidatePath here on purpose: re-rendering this school's page would swap the
    // confirmation for "School not found". The panel sends the owner to the schools list.
    return { filesRemoved, filesFailed };
  });
}
