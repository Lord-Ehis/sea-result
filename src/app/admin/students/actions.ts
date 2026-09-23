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

// Trimmed before validation, so a stray space left behind while clearing a
// field is treated as empty rather than rejected (see the same fix on the
// school profile form).
const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);

// Same trim-then-validate shape as photoUrl below — an email/URL validator
// otherwise rejects a stray space instead of treating it as cleared.
const optionalEmail = z.preprocess(trim, z.union([z.literal(""), z.string().email("Enter a valid email address")])).optional();

const profileFields = {
  dateOfBirth: z.preprocess(trim, z.union([z.literal(""), z.iso.date("Enter a valid date")])).optional(),
  gender: z.preprocess(trim, z.string().max(30)).optional(),
  admissionNumber: z.preprocess(trim, z.string().max(50)).optional(),
  height: z.preprocess(trim, z.string().max(30)).optional(),
  weight: z.preprocess(trim, z.string().max(30)).optional(),
  favouriteColour: z.preprocess(trim, z.string().max(50)).optional(),
  clubOrSociety: z.preprocess(trim, z.string().max(100)).optional(),
  photoUrl: z.preprocess(trim, z.union([z.literal(""), z.string().url("Enter a valid image URL, e.g. https://...").max(2048)])).optional(),
};

const createStudentSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  studentCode: z.string().trim().min(1, "Student ID/code is required"),
  campusId: z.string().min(1, "Campus is required"),
  classId: z.string().optional(),
  newClassName: z.string().trim().optional(),
  guardianName: z.string().trim().optional(),
  guardianPhone: z.string().trim().optional(),
  guardianEmail: optionalEmail,
  ...profileFields,
});

// FormData fields, keyed the same as `profileFields` above.
const PROFILE_FIELD_NAMES = ["dateOfBirth", "gender", "admissionNumber", "height", "weight", "favouriteColour", "clubOrSociety", "photoUrl"] as const;

function readProfileFields(formData: FormData) {
  return Object.fromEntries(PROFILE_FIELD_NAMES.map((name) => [name, formData.get(name) || undefined]));
}

// "" (cleared) and undefined (untouched) both mean "no value" — only a real
// string is kept, so the DB column stays null rather than an empty string.
function emptyToNull(v: string | undefined): string | null {
  return v ? v : null;
}

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
    ...readProfileFields(formData),
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
      guardianEmail: emptyToNull(parsed.guardianEmail),
      dateOfBirth: parsed.dateOfBirth ? new Date(parsed.dateOfBirth) : null,
      gender: emptyToNull(parsed.gender),
      admissionNumber: emptyToNull(parsed.admissionNumber),
      height: emptyToNull(parsed.height),
      weight: emptyToNull(parsed.weight),
      favouriteColour: emptyToNull(parsed.favouriteColour),
      clubOrSociety: emptyToNull(parsed.clubOrSociety),
      photoUrl: emptyToNull(parsed.photoUrl),
    },
  });

  revalidatePath("/admin/students");
}

const updateStudentSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  classId: z.string().optional(),
  guardianName: z.string().trim().optional(),
  guardianPhone: z.string().trim().optional(),
  guardianEmail: optionalEmail,
  ...profileFields,
});

// Everything about a student except their ID/code (used for parent lookup —
// left stable once assigned) and campus (a reassignment across campuses
// would cross a campus admin's access boundary, so it's not offered here).
export async function updateStudent(studentId: string, formData: FormData) {
  const access = await getAdminAccess();
  const { schoolId } = access;
  const parsed = updateStudentSchema.parse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    classId: formData.get("classId") || undefined,
    guardianName: formData.get("guardianName") || undefined,
    guardianPhone: formData.get("guardianPhone") || undefined,
    guardianEmail: formData.get("guardianEmail") || undefined,
    ...readProfileFields(formData),
  });

  if (parsed.classId) {
    const klass = await prisma.class.findFirst({ where: { id: parsed.classId, schoolId, ...classWhere(access) }, select: { id: true } });
    if (!klass) throw new Error("Class not found.");
  }

  const updated = await prisma.student.updateMany({
    where: { id: studentId, schoolId, ...studentWhere(access) },
    data: {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      classId: parsed.classId ?? null,
      guardianName: emptyToNull(parsed.guardianName),
      guardianPhone: emptyToNull(parsed.guardianPhone),
      guardianEmail: emptyToNull(parsed.guardianEmail),
      dateOfBirth: parsed.dateOfBirth ? new Date(parsed.dateOfBirth) : null,
      gender: emptyToNull(parsed.gender),
      admissionNumber: emptyToNull(parsed.admissionNumber),
      height: emptyToNull(parsed.height),
      weight: emptyToNull(parsed.weight),
      favouriteColour: emptyToNull(parsed.favouriteColour),
      clubOrSociety: emptyToNull(parsed.clubOrSociety),
      photoUrl: emptyToNull(parsed.photoUrl),
    },
  });
  if (updated.count === 0) throw new Error("Student not found.");

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
