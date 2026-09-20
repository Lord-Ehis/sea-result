import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { termNumberFromLabel } from "../../src/lib/term-number";

// Phase 4: gives every existing template and batch a term number (1, 2 or 3)
// by reading the label it already has ("Term 2, 2025/2026", "First Term", …).
// Labels are never rewritten — stored results are filed under them — and
// anything that can't be read with confidence is reported and left blank for
// an admin to set in Result templates, never guessed.
// Idempotent. Run: npx tsx prisma/scripts/backfill-term-numbers.ts

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const templates = await prisma.resultTemplate.findMany({ where: { termNumber: null }, select: { id: true, name: true, term: true } });
  let templatesSet = 0;
  for (const t of templates) {
    const n = termNumberFromLabel(t.term);
    if (n === null) {
      console.log(`  template "${t.name}" — can't read a term number from ${t.term ? `"${t.term}"` : "an empty term"}; left unset`);
      continue;
    }
    await prisma.resultTemplate.update({ where: { id: t.id }, data: { termNumber: n } });
    templatesSet++;
  }

  const batches = await prisma.resultBatch.findMany({
    where: { termNumber: null },
    select: { id: true, term: true, template: { select: { name: true, termNumber: true } } },
  });
  let batchesSet = 0;
  for (const b of batches) {
    const n = termNumberFromLabel(b.term) ?? null;
    if (n === null) {
      console.log(`  batch of "${b.template.name}" (${b.term}) — can't read a term number; left unset`);
      continue;
    }
    await prisma.resultBatch.update({ where: { id: b.id }, data: { termNumber: n } });
    batchesSet++;
  }

  console.log(`Templates: ${templatesSet} set, ${templates.length - templatesSet} left unset. Batches: ${batchesSet} set, ${batches.length - batchesSet} left unset.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
