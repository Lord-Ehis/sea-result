import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// One-off: the Phase 1 backfill split each migrated template's weights evenly
// (e.g. 50/50) because the old Grid model had no weights. Phase 2 makes
// activated versions use weighted totals, and an even split would change the
// numbers of any template whose marks aren't even (30/70 marks, say). For
// DRAFT versions whose weights are still exactly that untouched even split,
// set each weight to its share of the maximum marks (weight = max / Σmax × 100)
// so activating reproduces today's totals. Anything an admin has edited is left alone.
//
// Preview:  npx tsx prisma/scripts/reweight-draft-versions.ts --dry-run
// Apply:    npx tsx prisma/scripts/reweight-draft-versions.ts

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const dryRun = process.argv.includes("--dry-run");

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Same arithmetic as the backfill's evenWeights, so "untouched" is detectable.
function evenWeights(count: number): number[] {
  const base = Math.floor((100 / count) * 100) / 100;
  const weights = new Array(count).fill(base);
  weights[count - 1] = round2(100 - base * (count - 1));
  return weights;
}

function proportionalWeights(maxes: number[]): number[] {
  const total = maxes.reduce((a, b) => a + b, 0);
  const weights = maxes.map((m) => round2((m / total) * 100));
  weights[weights.length - 1] = round2(100 - weights.slice(0, -1).reduce((a, b) => a + b, 0));
  return weights;
}

async function main() {
  const versions = await prisma.templateVersion.findMany({
    where: { status: "DRAFT" },
    include: { template: { select: { name: true } }, sections: { include: { components: { orderBy: { displayOrder: "asc" } } } } },
  });

  let changed = 0;
  for (const version of versions) {
    const sections = version.sections.filter((s) => s.components.length > 0);
    if (sections.length === 0) continue;

    const untouched = sections.every((s) => {
      const even = evenWeights(s.components.length);
      return s.components.every((c, i) => Math.abs(c.weightPercent.toNumber() - even[i]) < 0.005);
    });
    if (!untouched) {
      console.log(`Skipped "${version.template.name}" v${version.versionNumber}: weights were edited.`);
      continue;
    }

    const updates = sections.flatMap((s) => {
      const maxes = s.components.map((c) => c.maxScore.toNumber());
      if (maxes.some((m) => m <= 0)) return [];
      const next = proportionalWeights(maxes);
      return s.components.map((c, i) => ({ id: c.id, from: c.weightPercent.toNumber(), to: next[i] })).filter((u) => Math.abs(u.from - u.to) >= 0.005);
    });
    if (updates.length === 0) {
      console.log(`"${version.template.name}" v${version.versionNumber}: already proportional.`);
      continue;
    }

    const sample = sections[0].components.map((c, i) => `${c.componentName} ${c.weightPercent.toNumber()}→${proportionalWeights(sections[0].components.map((x) => x.maxScore.toNumber()))[i]}`);
    console.log(`${dryRun ? "[dry run] Would update" : "Updating"} "${version.template.name}" v${version.versionNumber} (${updates.length} weights): ${sample.join(", ")}`);
    if (!dryRun) {
      await prisma.$transaction(
        updates.map((u) => prisma.assessmentComponent.update({ where: { id: u.id }, data: { weightPercent: u.to } })),
        { timeout: 120_000, maxWait: 20_000 },
      );
    }
    changed++;
  }
  console.log(`Done. ${dryRun ? "Would change" : "Changed"} ${changed} draft version(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
