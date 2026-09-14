"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAndSendNotification } from "@/lib/notifications";

async function requireSchoolAdmin() {
  const session = await auth();
  if (!session?.user.schoolId || session.user.role !== "SCHOOL_ADMIN") {
    throw new Error("Not authorized.");
  }
  return session.user.schoolId;
}

function generateTempPassword() {
  return crypto.randomBytes(9).toString("base64url"); // 12 chars, URL-safe
}

const inviteSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  classIds: z.array(z.string()).min(1, "Assign at least one class"),
});

export async function inviteTeacher(input: { name: string; email: string; classIds: string[] }) {
  const schoolId = await requireSchoolAdmin();
  const parsed = inviteSchema.parse(input);

  const existing = await prisma.user.findUnique({ where: { email: parsed.email } });
  if (existing) throw new Error("An account with this email already exists.");

  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

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

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await createAndSendNotification({
    schoolId,
    userId: teacher.id,
    channel: "EMAIL",
    event: "ACCOUNT_CREATED",
    recipient: parsed.email,
    subject: `You've been added as a teacher at ${school.name}`,
    message: `Hi ${parsed.name},\n\nYou've been added as a teacher on Sophie Educational Assistant for ${school.name}.\n\nSign in at ${baseUrl}/login with:\nEmail: ${parsed.email}\nTemporary password: ${tempPassword}\n\nPlease keep this password safe.`,
  });

  revalidatePath("/admin/teachers");
}

const assignmentsSchema = z.object({
  teacherId: z.string().min(1),
  classIds: z.array(z.string()),
});

export async function updateTeacherAssignments(input: { teacherId: string; classIds: string[] }) {
  const schoolId = await requireSchoolAdmin();
  const parsed = assignmentsSchema.parse(input);

  const teacher = await prisma.user.findFirst({ where: { id: parsed.teacherId, schoolId, role: "TEACHER" } });
  if (!teacher) throw new Error("Teacher not found.");

  await prisma.$transaction([
    prisma.teacherClassAssignment.deleteMany({ where: { teacherId: parsed.teacherId } }),
    prisma.teacherClassAssignment.createMany({
      data: parsed.classIds.map((classId) => ({ teacherId: parsed.teacherId, classId })),
    }),
  ]);

  revalidatePath("/admin/teachers");
}

export async function setTeacherActive(teacherId: string, isActive: boolean) {
  const schoolId = await requireSchoolAdmin();
  await prisma.user.update({
    where: { id: teacherId, schoolId, role: "TEACHER" },
    data: { isActive },
  });
  revalidatePath("/admin/teachers");
}
