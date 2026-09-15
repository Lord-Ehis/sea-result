"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireSchoolAdmin() {
  const session = await auth();
  if (!session?.user.schoolId || session.user.role !== "SCHOOL_ADMIN") {
    throw new Error("Not authorized.");
  }
  return session.user.schoolId;
}

const createClassesSchema = z.object({
  level: z.string().trim().min(1, "Level is required"),
  arms: z.string().trim().optional(),
  campusId: z.string().min(1, "Campus is required"),
  session: z.string().trim().min(1, "Academic session is required"),
});

export async function createClasses(input: { level: string; arms?: string; campusId: string; session: string }) {
  const schoolId = await requireSchoolAdmin();
  const parsed = createClassesSchema.parse(input);

  const campus = await prisma.campus.findFirst({ where: { id: parsed.campusId, schoolId } });
  if (!campus) throw new Error("Campus not found.");

  const arms = (parsed.arms ?? "")
    .split(/[,\n]/)
    .map((a) => a.trim())
    .filter(Boolean);

  const names = arms.length > 0 ? arms.map((arm) => `${parsed.level} ${arm}`) : [parsed.level];

  await prisma.class.createMany({
    data: names.map((name) => ({
      schoolId,
      campusId: campus.id,
      name,
      level: parsed.level,
      session: parsed.session,
    })),
  });

  revalidatePath("/admin/classes");
  revalidatePath("/admin/students");
}

const updateClassSchema = z.object({
  classId: z.string().min(1),
  name: z.string().trim().min(1, "Class name is required"),
  level: z.string().trim().min(1, "Level is required"),
  campusId: z.string().min(1, "Campus is required"),
  session: z.string().trim().min(1, "Academic session is required"),
});

export async function updateClass(input: { classId: string; name: string; level: string; campusId: string; session: string }) {
  const schoolId = await requireSchoolAdmin();
  const parsed = updateClassSchema.parse(input);

  const [existing, campus] = await Promise.all([
    prisma.class.findFirst({ where: { id: parsed.classId, schoolId } }),
    prisma.campus.findFirst({ where: { id: parsed.campusId, schoolId } }),
  ]);
  if (!existing) throw new Error("Class not found.");
  if (!campus) throw new Error("Campus not found.");

  await prisma.class.update({
    where: { id: parsed.classId },
    data: { name: parsed.name, level: parsed.level, campusId: campus.id, session: parsed.session },
  });

  revalidatePath("/admin/classes");
  revalidatePath("/admin/students");
}

export async function deleteClass(classId: string) {
  const schoolId = await requireSchoolAdmin();

  const existing = await prisma.class.findFirst({
    where: { id: classId, schoolId },
    include: { _count: { select: { students: true, resultTemplates: true } } },
  });
  if (!existing) throw new Error("Class not found.");
  if (existing._count.students > 0) throw new Error("Move or remove this class's students before deleting it.");
  if (existing._count.resultTemplates > 0) throw new Error("This class has result templates tied to it — remove those first.");

  await prisma.class.delete({ where: { id: classId } });

  revalidatePath("/admin/classes");
  revalidatePath("/admin/students");
}
