"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireFullAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { createAndSendNotification } from "@/lib/notifications";
import { createPasswordResetToken } from "@/lib/password-reset";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";

// Campus admins: School Admin accounts limited to the campuses chosen here.
// Only the main (unrestricted) admin can create, change or switch them off —
// a campus admin can't reach these actions (requireFullAdmin refuses them).

const campusIdsSchema = z.array(z.string().min(1)).min(1, "Choose at least one campus.");

const inviteSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  campusIds: campusIdsSchema,
});

async function assertCampusesOfSchool(schoolId: string, campusIds: string[]) {
  const unique = [...new Set(campusIds)];
  const found = await prisma.campus.count({ where: { id: { in: unique }, schoolId } });
  if (found !== unique.length) throw new UserError("One of those campuses doesn't exist in this school.");
  return unique;
}

// Only accounts that are already campus-restricted can be edited here, so the
// main admin can never be restricted, or locked out, by this page.
async function findCampusAdmin(schoolId: string, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, schoolId, role: "SCHOOL_ADMIN", campusScoped: true } });
  if (!user) throw new UserError("Campus admin not found.");
  return user;
}

export async function inviteCampusAdmin(input: { name: string; email: string; campusIds: string[] }): Promise<ActionResult> {
  const { schoolId } = await requireFullAdmin();
  return toResult(async () => {
    const parsed = inviteSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Those details aren't valid.");
    const { name, email } = parsed.data;
    const campusIds = await assertCampusesOfSchool(schoolId, parsed.data.campusIds);

    if (await prisma.user.findUnique({ where: { email } })) throw new UserError("An account with this email already exists.");

    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
    // Nobody signs in with this; the invite email carries a set-password link instead.
    const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString("base64url"), 10);

    const admin = await prisma.user.create({
      data: {
        schoolId,
        role: "SCHOOL_ADMIN",
        name,
        email,
        passwordHash,
        campusScoped: true,
        campusAccess: { create: campusIds.map((campusId) => ({ campusId })) },
      },
    });

    const token = await createPasswordResetToken(admin.id);
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    await createAndSendNotification({
      schoolId,
      userId: admin.id,
      channel: "EMAIL",
      event: "ACCOUNT_CREATED",
      recipient: email,
      subject: `You've been added as a campus administrator at ${school.name}`,
      message: `Hi ${name},\n\nYou've been added as a campus administrator on Sophie Educational Assistant for ${school.name}.\n\nSet your password to get started (this link expires in 1 hour):\n${baseUrl}/reset-password?token=${token}\n\nYour sign-in email is ${email}.`,
    });

    revalidatePath("/admin/team");
    return {};
  });
}

export async function updateCampusAdminAccess(input: { userId: string; campusIds: string[] }): Promise<ActionResult> {
  const { schoolId } = await requireFullAdmin();
  return toResult(async () => {
    const parsed = campusIdsSchema.safeParse(input.campusIds);
    if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Choose at least one campus.");
    const admin = await findCampusAdmin(schoolId, input.userId);
    const campusIds = await assertCampusesOfSchool(schoolId, parsed.data);

    await prisma.$transaction([
      prisma.userCampusAccess.deleteMany({ where: { userId: admin.id } }),
      prisma.userCampusAccess.createMany({ data: campusIds.map((campusId) => ({ userId: admin.id, campusId })) }),
    ]);

    revalidatePath("/admin/team");
    return {};
  });
}

export async function setCampusAdminActive(userId: string, isActive: boolean): Promise<ActionResult> {
  const { schoolId } = await requireFullAdmin();
  return toResult(async () => {
    const admin = await findCampusAdmin(schoolId, userId);
    await prisma.user.update({ where: { id: admin.id }, data: { isActive } });
    revalidatePath("/admin/team");
    return {};
  });
}
