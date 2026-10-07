"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getAdminAccess, requireFullAdmin } from "@/lib/admin-access";
import { campusWhere, classWhere, studentWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { defaultSessionLabel } from "@/lib/academic-term";
import { ImageError, validateImage } from "@/lib/image-validate";
import { StorageNotConfigured, putPublicImage } from "@/lib/storage";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";
import { MAX_STUDENT_IMPORT_BYTES, classKey, parseStudentSheet } from "@/lib/student-csv";

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

// Enrols a whole spreadsheet of students at once. The file is checked again
// here against the database (the browser's preview is only a convenience), and
// it is all or nothing: one bad row and nobody is added, so a corrected file
// can simply be uploaded again.
export async function importStudents(csv: string): Promise<ActionResult<{ created: number; classesCreated: number }>> {
  const access = await getAdminAccess();
  const { schoolId } = access;
  return toResult(async () => {
    if (typeof csv !== "string" || csv.length === 0) throw new UserError("Choose a file to import.");
    if (csv.length > MAX_STUDENT_IMPORT_BYTES) throw new UserError("That file is too large to import (limit 2 MB).");

    const [campuses, classes] = await Promise.all([
      prisma.campus.findMany({ where: { schoolId, ...campusWhere(access) }, select: { id: true, name: true } }),
      prisma.class.findMany({ where: { schoolId, ...classWhere(access) }, select: { id: true, name: true, campusId: true } }),
    ]);
    if (campuses.length === 0) throw new UserError("You have no campus to add students to.");

    // Look up only the codes in the file, not the whole school.
    const codes = parseStudentSheet(csv, { campuses, classes, existingCodes: new Set() }).rows.map((r) => r.studentCode);
    const taken = await prisma.student.findMany({ where: { schoolId, studentCode: { in: codes } }, select: { studentCode: true } });
    const preview = parseStudentSheet(csv, { campuses, classes, existingCodes: new Set(taken.map((t) => t.studentCode.toLowerCase())) });
    if (preview.errors.length > 0) {
      throw new UserError(`The file has ${preview.errors.length} problem${preview.errors.length === 1 ? "" : "s"}, starting with row ${preview.errors[0].row}: ${preview.errors[0].message} Nothing was imported.`);
    }
    if (preview.rows.length === 0) throw new UserError("The file has no students in it.");

    const session = defaultSessionLabel();
    try {
      const out = await prisma.$transaction(async (tx) => {
        const created = new Map<string, string>(); // campus|class -> new class id
        for (const r of preview.rows) {
          if (!r.newClassName) continue;
          const key = classKey(r.campusId, r.newClassName);
          if (created.has(key)) continue;
          const klass = await tx.class.create({ data: { schoolId, campusId: r.campusId, name: r.newClassName, session }, select: { id: true } });
          created.set(key, klass.id);
        }
        await tx.student.createMany({
          data: preview.rows.map((r) => ({
            schoolId,
            campusId: r.campusId,
            classId: r.newClassName ? created.get(classKey(r.campusId, r.newClassName))! : r.classId,
            studentCode: r.studentCode,
            firstName: r.firstName,
            lastName: r.lastName,
            guardianName: r.guardianName,
            guardianPhone: r.guardianPhone,
            guardianEmail: r.guardianEmail,
            dateOfBirth: r.dateOfBirth ? new Date(r.dateOfBirth) : null,
            gender: r.gender,
            admissionNumber: r.admissionNumber,
          })),
        });
        return { created: preview.rows.length, classesCreated: created.size };
      });
      revalidatePath("/admin/students");
      revalidatePath("/admin/classes");
      return out;
    } catch (err) {
      // Someone added one of these codes between the check and the write.
      if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
        throw new UserError("One of these student codes was just added by someone else. Nothing was imported; upload the file again.");
      }
      throw err;
    }
  });
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

// Stores an uploaded student photo and hands back its public URL for the
// form to fill in — the same "Upload image" pattern as the school profile's
// logo/signature/stamp (checked by its real bytes and a 1 MB limit, stored
// under a fresh unique name every time so an already-published result keeps
// the photo it was printed with). No studentId to scope the path by yet —
// this runs from both the Add and Edit forms, and Add has no student to
// attach to until the form is actually submitted — so it's filed under the
// school alone, the same as a school image.
export async function uploadStudentPhoto(formData: FormData): Promise<ActionResult<{ url: string }>> {
  const { schoolId } = await getAdminAccess();
  return toResult(async () => {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new UserError("Choose a photo to upload.");

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const type = validateImage(bytes);
      const url = await putPublicImage(`${schoolId}/students/photo-${randomUUID()}.${type}`, bytes, type);
      return { url };
    } catch (err) {
      if (err instanceof ImageError || err instanceof StorageNotConfigured) throw new UserError(err.message);
      throw err;
    }
  });
}
