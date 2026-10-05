"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireFullAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { ensureDefaultGradingScale } from "@/lib/grading-scale-defaults";
import type { TemplateField } from "./field-schemas";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";
import { compileVersionToFields, type CompileVersionInput } from "@/lib/version-compile";
import { validateVersionConfig, type ValidationResult } from "@/lib/version-validate";
import { z } from "zod";
import {
  PRESETS,
  updateVersionDraftSchema,
  type GradingScaleSummary,
  type PresetKey,
  type RatingCategoryInput,
  type SectionInput,
  type SubjectListSummary,
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
  opts?: { fromVersionId?: string; preset?: PresetKey; subjects?: string[] },
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
        : opts?.subjects && opts.subjects.length > 0
          ? {
              // A whole subject list at once: every name gets the chosen
              // (or default) component preset's shape, ready to fine-tune —
              // the same shape a lone "From preset" draft's one sample
              // subject gets, just applied to every name in the list.
              create: opts.subjects.map((name, si) => ({
                schoolId,
                name,
                displayOrder: si,
                components: {
                  create: PRESETS[opts.preset ?? "simple-40-60"].components.map((c, i) => ({
                    schoolId,
                    componentName: c.componentName,
                    componentCode: c.componentCode,
                    maxScore: c.maxScore,
                    weightPercent: c.weightPercent,
                    displayOrder: i,
                    isRequired: true,
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
    // Belt and suspenders alongside the bulk statements above: even a large
    // template's worth of edits should finish in well under this, but the
    // default 5s Prisma timeout left no margin at all.
  }, { timeout: 20_000 });

  revalidatePath("/admin/result-templates");
}

type Tx = Prisma.TransactionClient;

// Sections and their components used to be replaced with one DB round trip
// per row (update-or-create, awaited one at a time) — fine for a handful of
// subjects, but a full-size template (20+ subjects × 2+ components each)
// pushed the interactive transaction past Prisma's timeout, silently rolling
// back the whole save while the UI had already shown "Draft saved." Instead,
// every section and every component across the whole template is deleted,
// created or updated in ONE bulk statement each — 4 round trips total,
// however many subjects there are, instead of one per row.
async function replaceSections(
  tx: Tx,
  schoolId: string,
  versionId: string,
  existing: VersionWithRelations["sections"],
  incoming: SectionInput[],
) {
  const existingById = new Map(existing.map((s) => [s.id, s]));
  const incomingIds = new Set(incoming.map((s) => s.id));

  const toDelete = existing.filter((s) => !incomingIds.has(s.id)).map((s) => s.id);
  if (toDelete.length > 0) await tx.templateSection.deleteMany({ where: { id: { in: toDelete } } });

  const toCreate = incoming.filter((s) => !existingById.has(s.id));
  const toUpdate = incoming.filter((s) => existingById.has(s.id));

  if (toCreate.length > 0) {
    await tx.templateSection.createMany({
      data: toCreate.map((s) => ({ id: s.id, schoolId, versionId, name: s.name, displayOrder: s.displayOrder })),
    });
  }
  if (toUpdate.length > 0) {
    await bulkUpdate(
      tx,
      "template_sections",
      ["\"name\"", "\"displayOrder\""],
      toUpdate.map((s) => [s.id, s.name, s.displayOrder]),
      ["text", "int"],
    );
  }

  await replaceComponents(
    tx,
    schoolId,
    incoming.flatMap((s) => existingById.get(s.id)?.components ?? []),
    incoming.flatMap((s) => s.components.map((c) => ({ ...c, sectionId: s.id }))),
  );
}

async function replaceComponents(
  tx: Tx,
  schoolId: string,
  existing: VersionWithRelations["sections"][number]["components"],
  incoming: (SectionInput["components"][number] & { sectionId: string })[],
) {
  const flatExisting = existing;
  const existingIds = new Set(flatExisting.map((c) => c.id));
  const incomingIds = new Set(incoming.map((c) => c.id));

  const toDelete = flatExisting.filter((c) => !incomingIds.has(c.id)).map((c) => c.id);
  if (toDelete.length > 0) await tx.assessmentComponent.deleteMany({ where: { id: { in: toDelete } } });

  const toCreate = incoming.filter((c) => !existingIds.has(c.id));
  const toUpdate = incoming.filter((c) => existingIds.has(c.id));

  if (toCreate.length > 0) {
    await tx.assessmentComponent.createMany({
      data: toCreate.map((c) => ({
        id: c.id,
        schoolId,
        sectionId: c.sectionId,
        componentName: c.componentName,
        componentCode: c.componentCode,
        maxScore: c.maxScore,
        weightPercent: c.weightPercent,
        displayOrder: c.displayOrder,
        isRequired: c.isRequired,
      })),
    });
  }
  if (toUpdate.length > 0) {
    await bulkUpdate(
      tx,
      "assessment_components",
      ["\"componentName\"", "\"componentCode\"", "\"maxScore\"", "\"weightPercent\"", "\"displayOrder\"", "\"isRequired\""],
      toUpdate.map((c) => [c.id, c.componentName, c.componentCode, c.maxScore, c.weightPercent, c.displayOrder, c.isRequired]),
      ["text", "text", "decimal", "decimal", "int", "boolean"],
    );
  }
}

/**
 * `UPDATE <table> SET col = v.c0, ... FROM (VALUES (id, val, ...), ...) AS
 * v(id, c0, ...) WHERE t.id = v.id` — every row in `rows` (each `[id,
 * ...values]`, matching `columns`/`casts` in order) updated in one
 * statement, so a full-size template's worth of edits costs one round trip
 * instead of one per row. The VALUES alias uses plain, always-lowercase
 * names (c0, c1, ...) rather than the real (mixed-case, quoted) column
 * names, so there's no risk of Postgres's case-folding of unquoted
 * identifiers silently mismatching them.
 */
async function bulkUpdate(tx: Tx, table: string, columns: string[], rows: unknown[][], casts: string[]) {
  const aliases = columns.map((_, i) => `c${i}`);
  const setClause = Prisma.join(
    columns.map((col, i) => Prisma.sql`${Prisma.raw(col)} = v.${Prisma.raw(aliases[i])}`),
    ", ",
  );
  const valueRows = Prisma.join(
    rows.map((row) => {
      const [id, ...values] = row;
      const casted = values.map((val, i) => Prisma.sql`${val}::${Prisma.raw(casts[i])}`);
      return Prisma.sql`(${Prisma.join([Prisma.sql`${id}::text`, ...casted])})`;
    }),
    ", ",
  );
  const aliasList = Prisma.raw(["id", ...aliases].join(", "));
  await tx.$executeRaw`
    UPDATE ${Prisma.raw(`"${table}"`)} AS t SET ${setClause}, "updatedAt" = now()
    FROM (VALUES ${valueRows}) AS v(${aliasList})
    WHERE t."id" = v.id`;
}

async function replaceRatingCategories(
  tx: Tx,
  schoolId: string,
  versionId: string,
  existing: VersionWithRelations["ratingCategories"],
  incoming: RatingCategoryInput[],
) {
  const existingById = new Map(existing.map((c) => [c.id, c]));
  const incomingIds = new Set(incoming.map((c) => c.id));

  const toDelete = existing.filter((c) => !incomingIds.has(c.id)).map((c) => c.id);
  if (toDelete.length > 0) await tx.ratingCategory.deleteMany({ where: { id: { in: toDelete } } });

  const toCreate = incoming.filter((c) => !existingById.has(c.id));
  const toUpdate = incoming.filter((c) => existingById.has(c.id));

  for (const category of toCreate) {
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
  if (toUpdate.length > 0) {
    await bulkUpdate(
      tx,
      "rating_categories",
      ["\"name\"", "\"displayOrder\"", "\"ratingOptions\"", "\"ratingMeanings\""],
      toUpdate.map((c) => [c.id, c.name, c.displayOrder, JSON.stringify(c.ratingOptions), JSON.stringify(c.ratingMeanings ?? [])]),
      ["text", "int", "jsonb", "jsonb"],
    );
  }

  await replaceRatingItems(
    tx,
    schoolId,
    toUpdate.flatMap((c) => existingById.get(c.id)?.items ?? []),
    toUpdate.flatMap((c) => c.items.map((i) => ({ ...i, categoryId: c.id }))),
  );
}

async function replaceRatingItems(
  tx: Tx,
  schoolId: string,
  existing: VersionWithRelations["ratingCategories"][number]["items"],
  incoming: (RatingCategoryInput["items"][number] & { categoryId: string })[],
) {
  const flatExisting = existing;
  const existingIds = new Set(flatExisting.map((i) => i.id));
  const incomingIds = new Set(incoming.map((i) => i.id));

  const toDelete = flatExisting.filter((i) => !incomingIds.has(i.id)).map((i) => i.id);
  if (toDelete.length > 0) await tx.ratingItem.deleteMany({ where: { id: { in: toDelete } } });

  const toCreate = incoming.filter((i) => !existingIds.has(i.id));
  const toUpdate = incoming.filter((i) => existingIds.has(i.id));

  if (toCreate.length > 0) {
    await tx.ratingItem.createMany({
      data: toCreate.map((i) => ({ id: i.id, schoolId, categoryId: i.categoryId, name: i.name, displayOrder: i.displayOrder, isEnabled: i.isEnabled })),
    });
  }
  if (toUpdate.length > 0) {
    await bulkUpdate(
      tx,
      "rating_items",
      ["\"name\"", "\"displayOrder\"", "\"isEnabled\""],
      toUpdate.map((i) => [i.id, i.name, i.displayOrder, i.isEnabled]),
      ["text", "int", "boolean"],
    );
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

export async function listSubjectLists(): Promise<SubjectListSummary[]> {
  const { schoolId } = await requireSchoolAdmin();
  const lists = await prisma.subjectList.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    subjects: Array.isArray(l.subjects) ? (l.subjects as string[]) : [],
  }));
}

const createSubjectListSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  subjects: z.array(z.string().trim().min(1)).min(1, "Add at least one subject first."),
});

// Saves a draft's current subject names (not their scoring shape — that
// still comes from a component preset, picked separately when the list is
// applied) as a reusable, named list, so it doesn't have to be rebuilt by
// hand next term or for another class at the same level.
export async function createSubjectList(input: { name: string; subjects: string[] }): Promise<string> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = createSubjectListSchema.parse(input);

  const list = await prisma.subjectList.upsert({
    where: { schoolId_name: { schoolId, name: parsed.name } },
    create: { schoolId, name: parsed.name, subjects: parsed.subjects },
    update: { subjects: parsed.subjects },
  });

  revalidatePath("/admin/result-templates");
  return list.id;
}
