"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFullAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { fieldSchema, type TemplateField } from "./field-schemas";
import { isTermNumber, termLabel, termNumberFromLabel } from "@/lib/term-number";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";

// Re-exported so existing imports (`import type { TemplateField } from
// "./actions"`) across the app keep working — the real definitions live in
// field-schemas.ts, a plain module, since a "use server" file may only
// export async functions, not types or const Zod schemas.
export type {
  GradeBand,
  GridSubject,
  GridRawColumn,
  GridRemarksEntry,
  WeightedPart,
  GridConfig,
  ComputedFormula,
  TemplateField,
} from "./field-schemas";

// School-wide setting: a campus admin is refused (see src/lib/admin-access.ts).
async function requireSchoolAdmin() {
  return (await requireFullAdmin()).schoolId;
}

export async function createTemplate(name: string) {
  const schoolId = await requireSchoolAdmin();
  const template = await prisma.$transaction(async (tx) => {
    const created = await tx.resultTemplate.create({ data: { schoolId, name, fields: [] } });
    await tx.templateVersion.create({ data: { schoolId, templateId: created.id, versionNumber: 1, status: "DRAFT" } });
    return created;
  });
  revalidatePath("/admin/result-templates");
  return template.id;
}

const templateMetaSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Template name is required"),
  classId: z.string().optional(),
  level: z.string().trim().optional(),
  term: z.string().trim().optional(),
  termNumber: z.number().int().min(1).max(3).nullable().optional(),
});

// Name/scope/term editing — independent of `fields`, so it works whether or
// not the template has moved to the versioned builder (saveTemplate's
// whole-`fields`-array path is rejected once any TemplateVersion exists).
export async function updateTemplateMeta(input: {
  id: string;
  name: string;
  classId?: string;
  level?: string;
  term?: string;
  termNumber?: number | null;
}): Promise<ActionResult> {
  const schoolId = await requireSchoolAdmin();
  const parsed = templateMetaSchema.parse(input);

  return toResult(async () => {
    const current = await prisma.resultTemplate.findFirst({ where: { id: parsed.id, schoolId } });
    if (!current) throw new UserError("Template not found.");

    // Picking a term number sets the label ("1st Term", "2nd Term", "3rd Term").
    // Without one, a label the school already uses is left exactly as written
    // (stored results are filed under it) and its number is read from it.
    const termNumber = isTermNumber(parsed.termNumber) ? parsed.termNumber : termNumberFromLabel(parsed.term);
    const term = isTermNumber(parsed.termNumber) ? termLabel(parsed.termNumber) : parsed.term || null;

    // Results are filed under the term label, so changing it while some are
    // still being worked on would strand them under the old one.
    if (term !== current.term) {
      const inProgress = await prisma.result.count({ where: { schoolId, templateId: current.id, status: { not: "PUBLISHED" } } });
      if (inProgress > 0) {
        throw new UserError(
          `Can't change the term yet: ${inProgress} result record(s) for this template are still in progress (draft, submitted or sent back). Publish or clear them first.`,
        );
      }
    }

    await prisma.resultTemplate.update({
      where: { id: parsed.id, schoolId },
      data: {
        name: parsed.name,
        classId: parsed.classId || null,
        level: parsed.classId ? null : parsed.level || null,
        term,
        termNumber,
      },
    });

    revalidatePath("/admin/result-templates");
    return {};
  });
}

const saveTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Template name is required"),
  classId: z.string().optional(),
  level: z.string().trim().optional(),
  term: z.string().trim().optional(),
  fields: z.array(fieldSchema),
}).refine(
  (input) => input.fields.filter((f) => f.type === "Grid").length <= 1,
  { message: "Only one Grid field is supported per template.", path: ["fields"] },
);

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

  const versionCount = await prisma.templateVersion.count({ where: { templateId: parsed.id, schoolId } });
  if (versionCount > 0) {
    throw new Error("This template now uses the versioned editor above — edit its draft version instead.");
  }

  await prisma.resultTemplate.update({
    where: { id: parsed.id, schoolId },
    data: {
      name: parsed.name,
      // A specific class always wins in the fallback lookup, so the two
      // are mutually exclusive here rather than both being set.
      classId: parsed.classId || null,
      level: parsed.classId ? null : parsed.level || null,
      term: parsed.term || null,
      termNumber: termNumberFromLabel(parsed.term),
      fields: parsed.fields,
    },
  });

  revalidatePath("/admin/result-templates");
}
