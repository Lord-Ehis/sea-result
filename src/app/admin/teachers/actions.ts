"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getAdminAccess, type AdminAccess } from "@/lib/admin-access";
import { classWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { createAndSendNotification } from "@/lib/notifications";
import { createPasswordResetToken } from "@/lib/password-reset";
import { changeUserEmail } from "@/lib/change-email";
import { forgetUserSession } from "@/lib/session-validity";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";

// Every class id must be a real class of this school that this admin may manage.
async function assertClassesInScope(access: AdminAccess, classIds: string[]) {
  const unique = [...new Set(classIds)];
  const found = await prisma.class.count({ where: { id: { in: unique }, schoolId: access.schoolId, ...classWhere(access) } });
  if (found !== unique.length) throw new Error("One of those classes isn't available to you.");
}

// A campus admin manages teachers only where they teach in their own campuses.
async function findTeacherInScope(access: AdminAccess, teacherId: string) {
  return prisma.user.findFirst({
    where: {
      id: teacherId,
      schoolId: access.schoolId,
      role: "TEACHER",
      ...(access.campusIds === null ? {} : { teachingAssignments: { some: { class: classWhere(access) } } }),
    },
  });
}

// An account-wide change (switching it off, replacing its email) affects every
// campus the teacher works in, so a campus admin may only make it for a
// teacher who works nowhere else.
async function assertAccountOnlyInScope(access: AdminAccess, teacherId: string) {
  if (access.campusIds === null) return;
  const elsewhere = await prisma.teacherClassAssignment.count({ where: { teacherId, NOT: { class: classWhere(access) } } });
  if (elsewhere > 0) throw new UserError("This teacher also teaches at another campus. Ask the school's main administrator to change their account.");
}

/**
 * New accounts get an unusable random password — nobody is meant to sign
 * in with it. The invite email carries a set-password link instead
 * (src/lib/password-reset.ts), the same mechanism forgot-password uses.
 */
function generateUnusablePassword() {
  return crypto.randomBytes(24).toString("base64url");
}

const inviteSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  classIds: z.array(z.string()).min(1, "Assign at least one class"),
});

export async function inviteTeacher(input: { name: string; email: string; classIds: string[] }) {
  const access = await getAdminAccess();
  const { schoolId } = access;
  const parsed = inviteSchema.parse(input);
  await assertClassesInScope(access, parsed.classIds);

  const existing = await prisma.user.findUnique({ where: { email: parsed.email } });
  if (existing) throw new Error("An account with this email already exists.");

  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
  const passwordHash = await bcrypt.hash(generateUnusablePassword(), 10);

  const teacher = await prisma.user.create({
    data: {
      schoolId,
      role: "TEACHER",
      name: parsed.name,
      email: parsed.email,
      passwordHash,
      teachingAssignments: {
        create: parsed.classIds.map((classId) => ({ classId })),
      },
    },
  });

  const token = await createPasswordResetToken(teacher.id);
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/reset-password?token=${token}`;

  await createAndSendNotification({
    schoolId,
    userId: teacher.id,
    channel: "EMAIL",
    event: "ACCOUNT_CREATED",
    recipient: parsed.email,
    subject: `You've been added as a teacher at ${school.name}`,
    message: `Hi ${parsed.name},\n\nYou've been added as a teacher on Sophie Educational Assistant for ${school.name}.\n\nSet your password to get started (this link expires in 1 hour):\n${link}\n\nYour sign-in email is ${parsed.email}.`,
  });

  revalidatePath("/admin/teachers");
}

const assignmentsSchema = z.object({
  teacherId: z.string().min(1),
  classIds: z.array(z.string()),
});

export async function updateTeacherAssignments(input: { teacherId: string; classIds: string[] }) {
  const access = await getAdminAccess();
  const parsed = assignmentsSchema.parse(input);

  const teacher = await findTeacherInScope(access, parsed.teacherId);
  if (!teacher) throw new Error("Teacher not found.");
  await assertClassesInScope(access, parsed.classIds);

  // Only this admin's own campuses are replaced; assignments the teacher has in
  // other campuses belong to someone else and are left exactly as they are.
  await prisma.$transaction([
    prisma.teacherClassAssignment.deleteMany({ where: { teacherId: parsed.teacherId, class: classWhere(access) } }),
    prisma.teacherClassAssignment.createMany({
      data: [...new Set(parsed.classIds)].map((classId) => ({ teacherId: parsed.teacherId, classId })),
    }),
  ]);

  revalidatePath("/admin/teachers");
}

export async function setTeacherActive(teacherId: string, isActive: boolean) {
  const access = await getAdminAccess();
  const teacher = await findTeacherInScope(access, teacherId);
  if (!teacher) throw new Error("Teacher not found.");

  await assertAccountOnlyInScope(access, teacherId);

  await prisma.user.update({ where: { id: teacher.id }, data: { isActive } });
  forgetUserSession(teacher.id);
  revalidatePath("/admin/teachers");
}

/**
 * Replaces the email a teacher signs in with — the recovery path when they've
 * lost their inbox. The teacher then sets a new password from a link sent to
 * the new address.
 */
export async function changeTeacherEmail(input: { teacherId: string; email: string }): Promise<ActionResult<{ linkSent: boolean; email: string }>> {
  const access = await getAdminAccess();
  return toResult(async () => {
    const teacher = await findTeacherInScope(access, input.teacherId);
    if (!teacher) throw new UserError("Teacher not found.");
    await assertAccountOnlyInScope(access, teacher.id);
    const result = await changeUserEmail({
      targetUserId: teacher.id,
      newEmail: input.email,
      actor: { userId: access.userId, role: "SCHOOL_ADMIN", label: "your school administrator" },
    });
    revalidatePath("/admin/teachers");
    return { linkSent: result.linkSent, email: result.newEmail };
  });
}
