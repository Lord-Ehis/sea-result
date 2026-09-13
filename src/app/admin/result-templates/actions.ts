"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type TemplateField = {
  id: string;
  name: string;
  type: "Number" | "Text" | "Dropdown" | "Rating scale";
};

async function requireSchoolAdmin() {
  const session = await auth();
  if (!session?.user.schoolId || session.user.role !== "SCHOOL_ADMIN") {
    throw new Error("Not authorized.");
  }
  return session.user.schoolId;
}

export async function createTemplate(name: string) {
  const schoolId = await requireSchoolAdmin();
  const template = await prisma.resultTemplate.create({
    data: { schoolId, name, fields: [] },
  });
  revalidatePath("/admin/result-templates");
  return template.id;
}

const fieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["Number", "Text", "Dropdown", "Rating scale"]),
});

const saveTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Template name is required"),
  classId: z.string().optional(),
  term: z.string().trim().optional(),
  fields: z.array(fieldSchema),
});

export async function saveTemplate(input: {
  id: string;
  name: string;
  classId?: string;
  term?: string;
  fields: TemplateField[];
}) {
  const schoolId = await requireSchoolAdmin();
  const parsed = saveTemplateSchema.parse(input);

  await prisma.resultTemplate.update({
    where: { id: parsed.id, schoolId },
    data: {
      name: parsed.name,
      classId: parsed.classId || null,
      term: parsed.term || null,
      fields: parsed.fields,
    },
  });

  revalidatePath("/admin/result-templates");
}
