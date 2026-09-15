"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type GradeBand = { min: number; max: number; label: string };
export type ComputedFormula =
  | { kind: "sum"; of: string[] }
  | { kind: "average"; of: string[] }
  | { kind: "grade"; of: string; bands: GradeBand[] }
  | { kind: "position"; of: string }
  | { kind: "cumulative"; of: string; aggregate: "sum" | "average" };
export type TemplateField = {
  id: string;
  name: string;
  type: "Number" | "Text" | "Dropdown" | "Rating scale" | "Computed";
  formula?: ComputedFormula;
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

const gradeBandSchema = z.object({ min: z.number(), max: z.number(), label: z.string() });
const formulaSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("sum"), of: z.array(z.string()) }),
  z.object({ kind: z.literal("average"), of: z.array(z.string()) }),
  z.object({ kind: z.literal("grade"), of: z.string(), bands: z.array(gradeBandSchema) }),
  z.object({ kind: z.literal("position"), of: z.string() }),
  z.object({ kind: z.literal("cumulative"), of: z.string(), aggregate: z.enum(["sum", "average"]) }),
]);

const fieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["Number", "Text", "Dropdown", "Rating scale", "Computed"]),
  formula: formulaSchema.optional(),
});

const saveTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Template name is required"),
  classId: z.string().optional(),
  level: z.string().trim().optional(),
  term: z.string().trim().optional(),
  fields: z.array(fieldSchema),
});

export async function saveTemplate(input: {
  id: string;
  name: string;
  classId?: string;
  level?: string;
  term?: string;
  fields: TemplateField[];
}) {
  const schoolId = await requireSchoolAdmin();
  const parsed = saveTemplateSchema.parse(input);

  await prisma.resultTemplate.update({
    where: { id: parsed.id, schoolId },
    data: {
      name: parsed.name,
      // A specific class always wins in the fallback lookup, so the two
      // are mutually exclusive here rather than both being set.
      classId: parsed.classId || null,
      level: parsed.classId ? null : parsed.level || null,
      term: parsed.term || null,
      fields: parsed.fields,
    },
  });

  revalidatePath("/admin/result-templates");
}
