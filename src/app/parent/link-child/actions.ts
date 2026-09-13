"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const linkSchema = z.object({
  studentCode: z.string().trim().min(1),
  fullName: z.string().trim().min(1),
});

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function linkChild(input: { studentCode: string; fullName: string }) {
  const session = await auth();
  if (!session?.user.schoolId || session.user.role !== "PARENT") {
    throw new Error("Not authorized.");
  }
  const parsed = linkSchema.parse(input);

  const student = await prisma.student.findFirst({
    where: { schoolId: session.user.schoolId, studentCode: { equals: parsed.studentCode, mode: "insensitive" } },
    include: { class: true, campus: true },
  });

  if (!student || normalizeName(`${student.firstName} ${student.lastName}`) !== normalizeName(parsed.fullName)) {
    throw new Error("We couldn't match those details. Check the student code and full name.");
  }

  const existingLink = await prisma.parentStudentLink.findUnique({
    where: { parentUserId_studentId: { parentUserId: session.user.id, studentId: student.id } },
  });
  if (existingLink) {
    throw new Error(`${student.firstName} ${student.lastName} is already linked to your account.`);
  }

  await prisma.parentStudentLink.create({
    data: { parentUserId: session.user.id, studentId: student.id },
  });

  revalidatePath("/parent/dashboard");

  return {
    name: `${student.firstName} ${student.lastName}`,
    className: student.class?.name ?? null,
    campusName: student.campus.name,
  };
}
