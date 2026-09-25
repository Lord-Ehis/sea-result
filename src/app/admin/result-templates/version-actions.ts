"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { requireFullAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { ensureDefaultGradingScale } from "@/lib/grading-scale-defaults";
import type { TemplateField } from "./field-schemas";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";
import { compileVersionToFields, type CompileVersionInput } from "@/lib/version-compile";
import { validateVersionConfig, type ValidationResult } from "@/lib/version-validate";
import {
  PRESETS,
  updateVersionDraftSchema,
  type GradingScaleSummary,
  type PresetKey,
  type RatingCategoryInput,
  type SectionInput,
  type TemplateVersionSummary,
} from "./version-types";

// School-wide setting: a campus admin is refused (see src/lib/admin-access.ts).
async function requireSchoolAdmin() {
  const { schoolId, userId } = await requireFullAdmin();
  return { schoolId, userId };
}

const versionInclude = {
  sections: { include: { components: { orderBy: { displayOrder: "asc" as const } } }, orderBy: { displayOrder: "asc" as const } },
  ratingCategories: { include: { items: { orderBy: { displayOrder: "asc" as const } } }, orderBy: { displayOrder: "asc" as const } },
};

type VersionWithRelations = NonNullable<Awaited<ReturnType<typeof fetchVersion>>>;

async function fetchVersion(versionId: string, schoolId: string) {
  return prisma.templateVersion.findFirst({ where: { id: versionId, schoolId }, include: versionInclude });
}

function serializeVersion(version: VersionWithRelations): TemplateVersionSummary {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    status: version.status,
    gradingScaleId: version.gradingScaleId,
    createdAt: version.createdAt.toISOString(),
    activatedAt: version.activatedAt?.toISOString() ?? null,
    legacyFields: legacyFieldsFromJson(version.legacyFields) as TemplateField[],
    includeAnnualSummary: version.includeAnnualSummary,
    includeAttendance: version.includeAttendance,
    includeRemarks: version.includeRemarks,
    sections: version.sections.map((s) => ({
      id: s.id,
      name: s.name,
      displayOrder: s.displayOrder,
      components: s.components.map((c) => ({
        id: c.id,
        componentName: c.componentName,
        componentCode: c.componentCode,
        maxScore: c.maxScore.toNumber(),
        weightPercent: c.weightPercent.toNumber(),
        displayOrder: c.displayOrder,
        isRequired: c.isRequired,
      })),
    })),
    ratingCategories: version.ratingCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      displayOrder: cat.displayOrder,
      ratingOptions: Array.isArray(cat.ratingOptions) ? (cat.ratingOptions as string[]) : [],
      ratingMeanings: Array.isArray(cat.ratingMeanings) ? (cat.ratingMeanings as string[]) : [],
      items: cat.items.map((i) => ({ id: i.id, name: i.name, displayOrder: i.displayOrder, isEnabled: i.isEnabled })),
    })),
  };
}

export async function listGradingScales(): Promise<GradingScaleSummary[]> {
  const { schoolId } = await requireSchoolAdmin();
  const scales = await prisma.gradingScale.findMany({
    where: { schoolId },
    include: { bands: { orderBy: { displayOrder: "asc" } } },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return scales.map((s) => ({
    id: s.id,
    name: s.name,
    isDefault: s.isDefault,
    bands: s.bands.map((b) => ({
      minScore: b.minScore,
      maxScore: b.maxScore,
      gradeCode: b.gradeCode,
      remark: b.remark,
      displayOrder: b.displayOrder,
    })),
  }));
}

export async function getTemplateVersions(templateId: string): Promise<TemplateVersionSummary[]> {
  const { schoolId } = await requireSchoolAdmin();
  const versions = await prisma.templateVersion.findMany({
    where: { templateId, schoolId },
    include: versionInclude,
    orderBy: { versionNumber: "desc" },
  });
  return versions.map(serializeVersion);
}

export async function createDraftVersion(
  templateId: string,
  opts?: { fromVersionId?: string; preset?: PresetKey },
): Promise<string> {
  const { schoolId, userId } = await requireSchoolAdmin();

  const template = await prisma.resultTemplate.findFirst({ where: { id: templateId, schoolId } });
  if (!template) throw new Error("Template not found.");

  const last = await prisma.templateVersion.findFirst({
    where: { templateId, schoolId },
    orderBy: { versionNumber: "desc" },
  });
  const versionNumber = (last?.versionNumber ?? 0) + 1;

  const source = opts?.fromVersionId ? await fetchVersion(opts.fromVersionId, schoolId) : null;

  const created = await prisma.templateVersion.create({
    data: {
      schoolId,
      templateId,
      versionNumber,
      status: "DRAFT",
      createdByUserId: userId,
      gradingScaleId: source?.gradingScaleId ?? null,
      legacyGridFieldId: source?.legacyGridFieldId ?? null,
      legacyFields: source?.legacyFields ?? [],
      includeAnnualSummary: source?.includeAnnualSummary ?? false,
      includeAttendance: source?.includeAttendance ?? false,
      includeRemarks: source?.includeRemarks ?? false,
      sections: source
        ? {
            create: source.sections.map((s) => ({
              schoolId,
              name: s.name,
              displayOrder: s.displayOrder,
              // A subject keeps one id for the life of the template, so it can be
              // matched across terms (annual summary) and renames stay safe.
              legacySourceId: s.legacySourceId ?? s.id,
              components: {
                create: s.components.map((c) => ({
                  schoolId,
                  componentName: c.componentName,
                  componentCode: c.componentCode,
                  maxScore: c.maxScore,
                  weightPercent: c.weightPercent,
                  displayOrder: c.displayOrder,
                  isRequired: c.isRequired,
                  legacySourceId: c.legacySourceId ?? c.id,
                })),
              },
            })),
          }
        : opts?.preset
          ? {
              create: [
                {
                  schoolId,
                  name: "Sample subject",
                  displayOrder: 0,
                  components: {
                    create: PRESETS[opts.preset].components.map((c, i) => ({
                      schoolId,
                      componentName: c.componentName,
                      componentCode: c.componentCode,
                      maxScore: c.maxScore,
                      weightPercent: c.weightPercent,
                      displayOrder: i,
                      isRequired: true,
                    })),
                  },
                },
              ],
            }
          : undefined,
      ratingCategories: source
        ? {
            create: source.ratingCategories.map((cat) => ({
              schoolId,
              name: cat.name,
              displayOrder: cat.displayOrder,
              ratingOptions: cat.ratingOptions ?? [],
              ratingMeanings: cat.ratingMeanings ?? [],
              items: {
                create: cat.items.map((i) => ({
                  schoolId,
                  name: i.name,
                  displayOrder: i.displayOrder,
                  isEnabled: i.isEnabled,
                  legacySourceId: i.legacySourceId ?? i.id,
                })),
              },
            })),
          }
        : undefined,
    },
  });

  revalidatePath("/admin/result-templates");
  return created.id;
}

export async function updateVersionDraft(input: {
  versionId: string;
  gradingScaleId: string | null;
  sections: SectionInput[];
  ratingCategories: RatingCategoryInput[];
  legacyFields: TemplateField[];
  includeAnnualSummary?: boolean;
  includeAttendance?: boolean;
  includeRemarks?: boolean;
}) {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = updateVersionDraftSchema.parse(input);

  const version = await fetchVersion(parsed.versionId, schoolId);
  if (!version) throw new Error("Version not found.");
  if (version.status !== "DRAFT") throw new Error("Only a draft version can be edited — duplicate it into a new draft first.");

  await prisma.$transaction(async (tx) => {
    await tx.templateVersion.update({
      where: { id: version.id },
      data: { gradingScaleId: parsed.gradingScaleId, legacyFields: parsed.legacyFields, includeAnnualSummary: parsed.includeAnnualSummary, includeAttendance: parsed.includeAttendance, includeRemarks: parsed.includeRemarks },
    });

    await replaceSections(tx, schoolId, version.id, version.sections, parsed.sections);
    await replaceRatingCategories(tx, schoolId, version.id, version.ratingCategories, parsed.ratingCategories);
  });

  revalidatePath("/admin/result-templates");
}

type Tx = Prisma.TransactionClient;

async function replaceSections(
  tx: Tx,
  schoolId: string,
  versionId: string,
  existing: VersionWithRelations["sections"],
  incoming: SectionInput[],
) {
  const incomingIds = new Set(incoming.map((s) => s.id));

  const toDelete = existing.filter((s) => !incomingIds.has(s.id)).map((s) => s.id);
  if (toDelete.length > 0) await tx.templateSection.deleteMany({ where: { id: { in: toDelete } } });

  for (const section of incoming) {
    const existingSection = existing.find((s) => s.id === section.id);
    if (existingSection) {
      await tx.templateSection.update({
        where: { id: section.id },
        data: { name: section.name, displayOrder: section.displayOrder },
      });
      await replaceComponents(tx, schoolId, section.id, existingSection.components, section.components);
    } else {
      await tx.templateSection.create({
        data: {
          id: section.id,
          schoolId,
          versionId,
          name: section.name,
          displayOrder: section.displayOrder,
          components: {
            create: section.components.map((c) => ({
              id: c.id,
              schoolId,
              componentName: c.componentName,
              componentCode: c.componentCode,
              maxScore: c.maxScore,
              weightPercent: c.weightPercent,
              displayOrder: c.displayOrder,
              isRequired: c.isRequired,
            })),
          },
        },
      });
    }
  }
}

async function replaceComponents(
  tx: Tx,
  schoolId: string,
  sectionId: string,
  existing: VersionWithRelations["sections"][number]["components"],
  incoming: SectionInput["components"],
) {
  const existingIds = new Set(existing.map((c) => c.id));
  const incomingIds = new Set(incoming.map((c) => c.id));

  const toDelete = existing.filter((c) => !incomingIds.has(c.id)).map((c) => c.id);
  if (toDelete.length > 0) await tx.assessmentComponent.deleteMany({ where: { id: { in: toDelete } } });

  for (const c of incoming) {
    const data = {
      componentName: c.componentName,
      componentCode: c.componentCode,
      maxScore: c.maxScore,
      weightPercent: c.weightPercent,
      displayOrder: c.displayOrder,
      isRequired: c.isRequired,
    };
    if (existingIds.has(c.id)) {
      await tx.assessmentComponent.update({ where: { id: c.id }, data });
    } else {
      await tx.assessmentComponent.create({ data: { id: c.id, schoolId, sectionId, ...data } });
    }
  }
}

async function replaceRatingCategories(
  tx: Tx,
  schoolId: string,
  versionId: string,
  existing: VersionWithRelations["ratingCategories"],
  incoming: RatingCategoryInput[],
) {
  const incomingIds = new Set(incoming.map((c) => c.id));

  const toDelete = existing.filter((c) => !incomingIds.has(c.id)).map((c) => c.id);
  if (toDelete.length > 0) await tx.ratingCategory.deleteMany({ where: { id: { in: toDelete } } });

  for (const category of incoming) {
    const existingCategory = existing.find((c) => c.id === category.id);
    if (existingCategory) {
      await tx.ratingCategory.update({
        where: { id: category.id },
        data: { name: category.name, displayOrder: category.displayOrder, ratingOptions: category.ratingOptions, ratingMeanings: category.ratingMeanings ?? [] },
      });
      await replaceRatingItems(tx, schoolId, category.id, existingCategory.items, category.items);
    } else {
      await tx.ratingCategory.create({
        data: {
          id: category.id,
          schoolId,
          versionId,
          name: category.name,
          displayOrder: category.displayOrder,
          ratingOptions: category.ratingOptions,
          ratingMeanings: category.ratingMeanings ?? [],
          items: {
            create: category.items.map((i) => ({
              id: i.id,
              schoolId,
              name: i.name,
              displayOrder: i.displayOrder,
              isEnabled: i.isEnabled,
            })),
          },
        },
      });
    }
  }
}

async function replaceRatingItems(
  tx: Tx,
  schoolId: string,
  categoryId: string,
  existing: VersionWithRelations["ratingCategories"][number]["items"],
  incoming: RatingCategoryInput["items"],
) {
  const existingIds = new Set(existing.map((i) => i.id));
  const incomingIds = new Set(incoming.map((i) => i.id));

  const toDelete = existing.filter((i) => !incomingIds.has(i.id)).map((i) => i.id);
  if (toDelete.length > 0) await tx.ratingItem.deleteMany({ where: { id: { in: toDelete } } });

  for (const item of incoming) {
    const data = { name: item.name, displayOrder: item.displayOrder, isEnabled: item.isEnabled };
    if (existingIds.has(item.id)) {
      await tx.ratingItem.update({ where: { id: item.id }, data });
    } else {
      await tx.ratingItem.create({ data: { id: item.id, schoolId, categoryId, ...data } });
    }
  }
}

async function resolveGradingScaleForCompile(schoolId: string, gradingScaleId: string | null) {
  const scale = gradingScaleId
    ? await prisma.gradingScale.findFirst({ where: { id: gradingScaleId, schoolId }, include: { bands: true } })
    : await prisma.gradingScale.findFirst({ where: { schoolId, isDefault: true }, include: { bands: true } });

  if (!scale) return null;
  return { bands: scale.bands.map((b) => ({ minScore: b.minScore, maxScore: b.maxScore, gradeCode: b.gradeCode, remark: b.remark })) };
}

function legacyFieldsFromJson(value: VersionWithRelations["legacyFields"]): CompileVersionInput["legacyFields"] {
  return Array.isArray(value) ? (value as unknown as CompileVersionInput["legacyFields"]) : [];
}

function sectionsFromDb(sections: VersionWithRelations["sections"]): CompileVersionInput["sections"] {
  return sections.map((s) => ({
    id: s.id,
    legacySourceId: s.legacySourceId,
    name: s.name,
    displayOrder: s.displayOrder,
    components: s.components.map((c) => ({
      id: c.id,
      legacySourceId: c.legacySourceId,
      componentName: c.componentName,
      componentCode: c.componentCode,
      maxScore: c.maxScore.toNumber(),
      weightPercent: c.weightPercent.toNumber(),
      isRequired: c.isRequired,
      displayOrder: c.displayOrder,
    })),
  }));
}

function ratingCategoriesFromDb(categories: VersionWithRelations["ratingCategories"]): CompileVersionInput["ratingCategories"] {
  return categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    displayOrder: cat.displayOrder,
    ratingOptions: Array.isArray(cat.ratingOptions) ? (cat.ratingOptions as string[]) : [],
    ratingMeanings: Array.isArray(cat.ratingMeanings) ? (cat.ratingMeanings as string[]) : [],
    items: cat.items.map((i) => ({ id: i.id, legacySourceId: i.legacySourceId, name: i.name, isEnabled: i.isEnabled })),
  }));
}

function sectionsFromInput(sections: SectionInput[]): CompileVersionInput["sections"] {
  return sections.map((s) => ({
    id: s.id,
    legacySourceId: null,
    name: s.name,
    displayOrder: s.displayOrder,
    components: s.components.map((c) => ({
      id: c.id,
      legacySourceId: null,
      componentName: c.componentName,
      componentCode: c.componentCode,
      maxScore: c.maxScore,
      weightPercent: c.weightPercent,
      isRequired: c.isRequired,
      displayOrder: c.displayOrder,
    })),
  }));
}

function ratingCategoriesFromInput(categories: RatingCategoryInput[]): CompileVersionInput["ratingCategories"] {
  return categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    displayOrder: cat.displayOrder,
    ratingOptions: cat.ratingOptions,
    ratingMeanings: cat.ratingMeanings,
    items: cat.items.map((i) => ({ id: i.id, legacySourceId: null, name: i.name, isEnabled: i.isEnabled })),
  }));
}

export async function validateVersion(versionId: string): Promise<ValidationResult> {
  const { schoolId } = await requireSchoolAdmin();
  const version = await fetchVersion(versionId, schoolId);
  if (!version) throw new Error("Version not found.");

  const scale = await resolveGradingScaleForCompile(schoolId, version.gradingScaleId);

  return validateVersionConfig({
    sections: version.sections.map((s) => ({
      name: s.name,
      components: s.components.map((c) => ({
        componentName: c.componentName,
        componentCode: c.componentCode,
        weightPercent: c.weightPercent.toNumber(),
        maxScore: c.maxScore.toNumber(),
      })),
    })),
    gradingScale: scale,
  });
}

// Blocking problems (invalid weights, work in progress, an overlapping template)
// come back as `{ ok: false, error }` so the admin sees the real reason in
// production — see user-error.ts.
export async function activateVersion(versionId: string): Promise<ActionResult> {
  const { schoolId, userId } = await requireSchoolAdmin();
  return toResult(async () => {
    await activateVersionImpl(versionId, schoolId, userId);
    return {};
  });
}

async function activateVersionImpl(versionId: string, schoolId: string, userId: string) {
  const version = await fetchVersion(versionId, schoolId);
  if (!version) throw new UserError("Version not found.");
  if (version.status !== "DRAFT") throw new UserError("Only a draft version can be activated.");

  const validation = await validateVersion(versionId);
  if (validation.errors.length > 0) {
    throw new UserError(`Cannot activate: ${validation.errors.map((e) => e.message).join(" ")}`);
  }

  // Swapping the live fields under results that are mid-flight would change
  // what teachers are entering against and what the admin is reviewing.
  const inProgress = await prisma.result.count({
    where: { schoolId, templateId: version.templateId, status: { not: "PUBLISHED" } },
  });
  if (inProgress > 0) {
    throw new UserError(
      `Cannot activate: ${inProgress} result record(s) for this template are still in progress (draft, submitted or sent back). Finish and publish them first.`,
    );
  }

  // A class has exactly one active template per term (spec §5). Templates
  // with a different scope are fine — the most specific one wins at entry.
  const thisTemplate = await prisma.resultTemplate.findUniqueOrThrow({ where: { id: version.templateId } });
  const rivals = await prisma.resultTemplate.findMany({
    where: { schoolId, isActive: true, currentVersionId: { not: null }, id: { not: version.templateId } },
    select: { name: true, classId: true, level: true, term: true },
  });
  const sameTerm = (a: string | null, b: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
  const rival = rivals.find(
    (r) => sameTerm(r.term, thisTemplate.term) && r.classId === thisTemplate.classId && (r.classId !== null || r.level === thisTemplate.level),
  );
  if (rival) {
    throw new UserError(`Cannot activate: "${rival.name}" is already active for the same classes and term. Change this template's scope or term first.`);
  }

  const legacyGridFieldId = version.legacyGridFieldId ?? (version.sections.length > 0 ? randomUUID() : null);
  const resolvedGradingScale = await resolveGradingScaleForCompile(schoolId, version.gradingScaleId);
  const compiled = compileVersionToFields({
    legacyGridFieldId,
    legacyFields: legacyFieldsFromJson(version.legacyFields),
    resolvedGradingScale,
    sections: sectionsFromDb(version.sections),
    ratingCategories: ratingCategoriesFromDb(version.ratingCategories),
    includeAnnualSummary: version.includeAnnualSummary,
    includeAttendance: version.includeAttendance,
    includeRemarks: version.includeRemarks,
  });

  await prisma.$transaction(async (tx) => {
    await tx.templateVersion.updateMany({
      where: { templateId: version.templateId, status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });
    await tx.templateAssignment.updateMany({
      where: { versionId: { not: version.id }, version: { templateId: version.templateId } },
      data: { isActive: false },
    });

    await tx.templateVersion.update({
      where: { id: version.id },
      data: {
        status: "ACTIVE",
        legacyGridFieldId,
        activatedByUserId: userId,
        activatedAt: new Date(),
        compiledFieldsSnapshot: compiled,
      },
    });

    const template = await tx.resultTemplate.findUniqueOrThrow({ where: { id: version.templateId } });
    await tx.templateAssignment.create({
      data: {
        schoolId,
        versionId: version.id,
        classId: template.classId,
        level: template.level,
        term: template.term,
        isActive: true,
      },
    });

    await tx.resultTemplate.update({
      where: { id: version.templateId },
      data: { fields: compiled, currentVersionId: version.id },
    });
  });

  revalidatePath("/admin/result-templates");
}

export async function duplicateActiveVersionIntoDraft(templateId: string): Promise<string> {
  const { schoolId } = await requireSchoolAdmin();
  const template = await prisma.resultTemplate.findFirst({ where: { id: templateId, schoolId } });
  if (!template?.currentVersionId) throw new Error("This template has no active version to duplicate.");
  return createDraftVersion(templateId, { fromVersionId: template.currentVersionId });
}

export async function previewCompiledFields(input: {
  versionId: string;
  gradingScaleId: string | null;
  sections: SectionInput[];
  ratingCategories: RatingCategoryInput[];
  legacyFields: TemplateField[];
  includeAnnualSummary?: boolean;
  includeAttendance?: boolean;
  includeRemarks?: boolean;
}) {
  const { schoolId } = await requireSchoolAdmin();
  const version = await prisma.templateVersion.findFirst({
    where: { id: input.versionId, schoolId },
    select: { legacyGridFieldId: true },
  });
  if (!version) throw new Error("Version not found.");

  const resolvedGradingScale = await resolveGradingScaleForCompile(schoolId, input.gradingScaleId);
  return compileVersionToFields({
    legacyGridFieldId: version.legacyGridFieldId,
    legacyFields: input.legacyFields,
    resolvedGradingScale,
    sections: sectionsFromInput(input.sections),
    ratingCategories: ratingCategoriesFromInput(input.ratingCategories),
    includeAnnualSummary: input.includeAnnualSummary === true,
    includeAttendance: input.includeAttendance === true,
    includeRemarks: input.includeRemarks === true,
  });
}

export async function ensureSchoolHasDefaultGradingScale() {
  const { schoolId } = await requireSchoolAdmin();
  return ensureDefaultGradingScale(schoolId);
}

export async function createGradingScale(input: {
  name: string;
  bands: { minScore: number; maxScore: number; gradeCode: string; remark: string }[];
}): Promise<string> {
  const { schoolId } = await requireSchoolAdmin();
  const name = input.name.trim();
  if (!name) throw new Error("Grading scale name is required.");

  const scale = await prisma.gradingScale.create({
    data: {
      schoolId,
      name,
      isDefault: false,
      bands: {
        create: [...input.bands]
          .sort((a, b) => b.minScore - a.minScore)
          .map((b, i) => ({ schoolId, minScore: b.minScore, maxScore: b.maxScore, gradeCode: b.gradeCode, remark: b.remark, displayOrder: i })),
      },
    },
  });

  revalidatePath("/admin/result-templates");
  return scale.id;
}
