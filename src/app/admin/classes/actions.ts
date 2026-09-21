"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminAccess } from "@/lib/admin-access";
import { campusWhere, classWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";

const createClassesSchema = z.object({
  level: z.string().trim().min(1, "Level is required"),
  arms: z.string().trim().optional(),
  campusId: z.string().min(1, "Campus is required"),
  session: z.string().trim().min(1, "Academic session is required"),
});

export async function createClasses(input: { level: string; arms?: string; campusId: string; session: string }) {
  const access = await getAdminAccess();
  const { schoolId } = access;
  const parsed = createClassesSchema.parse(input);

  const campus = await prisma.campus.findFirst({ where: { id: parsed.campusId, schoolId, ...campusWhere(access) } });
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
  const access = await getAdminAccess();
  const { schoolId } = access;
  const parsed = updateClassSchema.parse(input);

  // Both where the class is now and where it's going must be the admin's own
  // campuses, so a class can't be moved out of (or into) someone else's.
  const [existing, campus] = await Promise.all([
    prisma.class.findFirst({ where: { id: parsed.classId, schoolId, ...classWhere(access) } }),
    prisma.campus.findFirst({ where: { id: parsed.campusId, schoolId, ...campusWhere(access) } }),
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
  const access = await getAdminAccess();
  const { schoolId } = access;

  const existing = await prisma.class.findFirst({
    where: { id: classId, schoolId, ...classWhere(access) },
    include: { _count: { select: { students: true, resultTemplates: true } } },
  });
  if (!existing) throw new Error("Class not found.");
  if (existing._count.students > 0) throw new Error("Move or remove this class's students before deleting it.");
  if (existing._count.resultTemplates > 0) throw new Error("This class has result templates tied to it — remove those first.");

  await prisma.class.delete({ where: { id: classId } });

  revalidatePath("/admin/classes");
  revalidatePath("/admin/students");
}
