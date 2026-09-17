"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type GradeBand = { min: number; max: number; label: string };
export type GridSubject = { id: string; name: string };
export type GridRawColumn = { id: string; name: string; maxMark: number };
export type GridRemarksEntry = { grade: string; remarks: string };
export type GridConfig = {
  subjects: GridSubject[];
  rawColumns: GridRawColumn[];
  gradeBands: GradeBand[];
  remarksMap: GridRemarksEntry[];
  // Gates the Cumulative Result columns (First/Second/Third Term,
  // Cumulative Total/Average/Grade/Remarks/Position) — a later round.
  includeCumulative: boolean;
};
export type ComputedFormula =
  | { kind: "sum"; of: string[] }
  | { kind: "average"; of: string[] }
  | { kind: "grade"; of: string; bands: GradeBand[] }
  | { kind: "position"; of: string }
  | { kind: "cumulative"; of: string; aggregate: "sum" | "average" }
  | { kind: "remarksLookup"; of: string; map: GridRemarksEntry[] }
  | {
      kind: "promotion";
      subjectFields: string[];
      compulsoryFields: string[];
      passMark: number;
      minOffered: number;
      minPassed: number;
      overallField: string;
      promotionScore: number;
    };
export type TemplateField = {
  id: string;
  name: string;
  type: "Number" | "Text" | "Dropdown" | "Rating scale" | "Computed" | "Grid";
  formula?: ComputedFormula;
  // Present iff type === "Grid" — a subjects × columns table (e.g. the
  // Cognitive Domain section of a Nigerian report card), stored as one
  // TemplateField so it slots into the existing flat-field list; its cell
  // values live in Result.data under composite keys (see src/lib/grid-compute.ts).
  grid?: GridConfig;
  // Only meaningful for type === "Rating scale". Undefined on older fields
  // (created before this was configurable) — falls back to the original
  // fixed 1-5 scale everywhere it's read, so already-published "3"s keep
  // meaning "3 of 5" rather than being silently reinterpreted.
  ratingOptions?: string[];
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
const gridRemarksEntrySchema = z.object({ grade: z.string(), remarks: z.string() });
const formulaSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("sum"), of: z.array(z.string()) }),
  z.object({ kind: z.literal("average"), of: z.array(z.string()) }),
  z.object({ kind: z.literal("grade"), of: z.string(), bands: z.array(gradeBandSchema) }),
  z.object({ kind: z.literal("position"), of: z.string() }),
  z.object({ kind: z.literal("cumulative"), of: z.string(), aggregate: z.enum(["sum", "average"]) }),
  z.object({ kind: z.literal("remarksLookup"), of: z.string(), map: z.array(gridRemarksEntrySchema) }),
  z.object({
    kind: z.literal("promotion"),
    subjectFields: z.array(z.string()),
    compulsoryFields: z.array(z.string()),
    passMark: z.number(),
    minOffered: z.number(),
    minPassed: z.number(),
    overallField: z.string(),
    promotionScore: z.number(),
  }),
]);

const gridConfigSchema = z.object({
  subjects: z.array(z.object({ id: z.string(), name: z.string() })),
  rawColumns: z.array(z.object({ id: z.string(), name: z.string(), maxMark: z.number() })),
  gradeBands: z.array(gradeBandSchema),
  remarksMap: z.array(gridRemarksEntrySchema),
  includeCumulative: z.boolean(),
});

const fieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["Number", "Text", "Dropdown", "Rating scale", "Computed", "Grid"]),
  formula: formulaSchema.optional(),
  grid: gridConfigSchema.optional(),
  ratingOptions: z.array(z.string()).optional(),
});

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
