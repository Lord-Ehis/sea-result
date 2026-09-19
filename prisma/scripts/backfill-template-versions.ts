import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { ensureDefaultGradingScale } from "../../src/lib/grading-scale-defaults";
import type { TemplateField } from "../../src/app/admin/result-templates/actions";

// One-time, idempotent data migration: converts every existing
// ResultTemplate row into a version-1 TemplateVersion under the new
// relational model. Every migrated version lands as DRAFT — never
// auto-activated — because weight_percent can't be losslessly inferred
// from the old Grid model (maxMark was always decorative, never a real
// weight). ResultTemplate.fields is never touched here; every existing
// template keeps working exactly as before until an admin explicitly
// reviews the auto-split weights and activates through the new UI.
//
// Run once: npx tsx prisma/scripts/backfill-template-versions.ts

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function evenWeights(count: number): number[] {
  if (count === 0) return [];
  const base = Math.floor((100 / count) * 100) / 100;
  const weights = new Array(count).fill(base);
  weights[count - 1] = Math.round((100 - base * (count - 1)) * 100) / 100;
  return weights;
}

function slugCode(name: string, used: Set<string>): string {
  const base = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 10) || "COMP";
  let code = base;
  let n = 2;
  while (used.has(code)) {
    code = `${base}${n}`;
    n++;
  }
  used.add(code);
  return code;
}

async function migrateTemplate(schoolId: string, template: { id: string; name: string; fields: unknown }) {
  const fields = Array.isArray(template.fields) ? (template.fields as unknown as TemplateField[]) : [];
  const gridField = fields.find((f) => f.type === "Grid" && f.grid);
  const ratingFields = fields.filter((f) => f.type === "Rating scale");
  const legacyFields = fields.filter((f) => f.type !== "Grid" && f.type !== "Rating scale");

  let gradingScaleId: string | null = null;

  await prisma.$transaction(async (tx) => {
    const version = await tx.templateVersion.create({
      data: {
        schoolId,
        templateId: template.id,
        versionNumber: 1,
        status: "DRAFT",
        legacyGridFieldId: gridField?.id ?? null,
        legacyFields,
      },
    });

    if (gridField?.grid) {
      const { subjects, rawColumns, gradeBands, remarksMap } = gridField.grid;
      const weights = evenWeights(rawColumns.length);
      // Computed once, reused identically for every subject's mirrored
      // component set — see the componentCode comment below.
      const componentCodes: string[] = [];
      const codesUsed = new Set<string>();
      for (const c of rawColumns) componentCodes.push(slugCode(c.name, codesUsed));

      if (gradeBands.length > 0) {
        const scale = await tx.gradingScale.create({
          data: {
            schoolId,
            name: `${template.name} grading scale (migrated)`,
            isDefault: false,
            bands: {
              create: [...gradeBands]
                .sort((a, b) => a.min - b.min)
                .map((b, i) => ({
                  schoolId,
                  minScore: b.min,
                  maxScore: b.max,
                  gradeCode: b.label,
                  remark: remarksMap.find((m) => m.grade === b.label)?.remarks ?? "",
                  displayOrder: i,
                })),
            },
          },
        });
        gradingScaleId = scale.id;
        await tx.templateVersion.update({ where: { id: version.id }, data: { gradingScaleId: scale.id } });
      }

      for (let si = 0; si < subjects.length; si++) {
        const subject = subjects[si];
        await tx.templateSection.create({
          data: {
            schoolId,
            versionId: version.id,
            name: subject.name,
            displayOrder: si,
            legacySourceId: subject.id,
            components: {
              create: rawColumns.map((c, ci) => ({
                schoolId,
                componentName: c.name,
                // The same code for every subject's mirrored component, so
                // compileVersionToFields can recombine them back into one
                // shared rawColumns list (see version-compile.ts).
                componentCode: componentCodes[ci],
                maxScore: c.maxMark,
                weightPercent: weights[ci],
                displayOrder: ci,
                isRequired: true,
                legacySourceId: c.id,
              })),
            },
          },
        });
      }
    }

    if (ratingFields.length > 0) {
      await tx.ratingCategory.create({
        data: {
          schoolId,
          versionId: version.id,
          name: "Legacy ratings",
          displayOrder: 0,
          ratingOptions: ratingFields[0].ratingOptions ?? ["1", "2", "3", "4", "5"],
          items: {
            create: ratingFields.map((f, i) => ({
              schoolId,
              name: f.name,
              displayOrder: i,
              isEnabled: true,
              legacySourceId: f.id,
            })),
          },
        },
      });
    }
    // A remote DB (e.g. Supabase) makes each query slow enough that a
    // many-subject template exceeds Prisma's default 5s interactive limit.
  }, { timeout: 120_000, maxWait: 20_000 });

  return gradingScaleId;
}

async function main() {
  const templates = await prisma.resultTemplate.findMany({ select: { id: true, schoolId: true, name: true, fields: true } });
  console.log(`Found ${templates.length} existing ResultTemplate row(s).`);

  const schoolIds = new Set(templates.map((t) => t.schoolId));
  for (const schoolId of schoolIds) {
    await ensureDefaultGradingScale(schoolId);
  }
  console.log(`Ensured a default grading scale for ${schoolIds.size} school(s).`);

  let migrated = 0;
  let skipped = 0;
  for (const template of templates) {
    const existing = await prisma.templateVersion.findFirst({ where: { templateId: template.id } });
    if (existing) {
      skipped++;
      continue;
    }
    await migrateTemplate(template.schoolId, template);
    migrated++;
    console.log(`Migrated "${template.name}" (${template.id}) -> version 1 (DRAFT).`);
  }

  console.log(`Done. Migrated ${migrated}, skipped ${skipped} (already had a version).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
