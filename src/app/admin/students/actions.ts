"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminAccess, requireFullAdmin } from "@/lib/admin-access";
import { campusWhere, classWhere, studentWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { defaultSessionLabel } from "@/lib/academic-term";

const createCampusSchema = z.object({
  name: z.string().trim().min(1, "Campus name is required"),
  address: z.string().trim().optional(),
});

export async function createCampus(formData: FormData) {
  const { schoolId } = await requireFullAdmin(); // adding a campus is a school-wide decision
  const parsed = createCampusSchema.parse({
    name: formData.get("name"),
    address: formData.get("address") || undefined,
  });

  await prisma.campus.create({
    data: { schoolId, name: parsed.name, address: parsed.address },
  });

  revalidatePath("/admin/students");
}

const createStudentSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  studentCode: z.string().trim().min(1, "Student ID/code is required"),
  campusId: z.string().min(1, "Campus is required"),
  classId: z.string().optional(),
  newClassName: z.string().trim().optional(),
  guardianName: z.string().trim().optional(),
  guardianPhone: z.string().trim().optional(),
  guardianEmail: z.string().trim().email("Enter a valid email address").optional(),
});

export async function createStudent(formData: FormData) {
  const access = await getAdminAccess();
  const { schoolId } = access;
  const parsed = createStudentSchema.parse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    studentCode: formData.get("studentCode"),
    campusId: formData.get("campusId"),
    classId: formData.get("classId") || undefined,
    newClassName: formData.get("newClassName") || undefined,
    guardianName: formData.get("guardianName") || undefined,
    guardianPhone: formData.get("guardianPhone") || undefined,
    guardianEmail: formData.get("guardianEmail") || undefined,
  });

  // A campus admin can only enrol students into their own campuses.
  const campus = await prisma.campus.findFirst({
    where: { id: parsed.campusId, schoolId, ...campusWhere(access) },
  });
  if (!campus) throw new Error("Campus not found.");

  let classId = parsed.classId;
  if (classId) {
    const klass = await prisma.class.findFirst({ where: { id: classId, schoolId, ...classWhere(access) }, select: { id: true } });
    if (!klass) throw new Error("Class not found.");
  }
  if (parsed.newClassName) {
    const newClass = await prisma.class.create({
      data: {
        schoolId,
        campusId: campus.id,
        name: parsed.newClassName,
        session: defaultSessionLabel(),
      },
    });
    classId = newClass.id;
  }

  const existing = await prisma.student.findUnique({
    where: { schoolId_studentCode: { schoolId, studentCode: parsed.studentCode } },
  });
  if (existing) throw new Error("A student with this ID/code already exists.");

  await prisma.student.create({
    data: {
      schoolId,
      campusId: campus.id,
      classId,
      studentCode: parsed.studentCode,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      guardianName: parsed.guardianName,
      guardianPhone: parsed.guardianPhone,
      guardianEmail: parsed.guardianEmail,
    },
  });

  revalidatePath("/admin/students");
}

export async function setStudentActive(studentId: string, isActive: boolean) {
  const access = await getAdminAccess();
  const updated = await prisma.student.updateMany({
    where: { id: studentId, schoolId: access.schoolId, ...studentWhere(access) },
    data: { isActive },
  });
  if (updated.count === 0) throw new Error("Student not found.");
  revalidatePath("/admin/students");
}
