import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient, type ResultStatus } from "@prisma/client";
import { buildSnapshotPayload, generateVerificationCode, snapshotChecksum } from "../../src/lib/snapshot";
import { termNumberFromLabel } from "../../src/lib/term-number";
import type { TemplateField } from "../../src/app/admin/result-templates/actions";

// Brings results published (or in flight) before Phase 3 into the new model:
//   1. every Result gets a ResultBatch (class + template + term + session),
//   2. every PUBLISHED Result gets a version-1 frozen snapshot, built from the
//      template and data as they are now, so parents read one code path,
//   3. every batch with published results gets a PUBLISHED audit event marked
//      `backfilled` (the earlier history was never recorded).
// Idempotent — safe to run again, e.g. right after deploying to pick up
// anything the old code published in between.
//
// Run: npx tsx prisma/scripts/backfill-phase3.ts

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const TX = { timeout: 120_000, maxWait: 20_000 };

function derivedStatus(statuses: ResultStatus[]): ResultStatus {
  const all = (s: ResultStatus) => statuses.every((x) => x === s);
  if (all("PUBLISHED")) return "PUBLISHED";
  if (statuses.includes("REJECTED")) return "REJECTED";
  if (all("APPROVED")) return "APPROVED";
  if (all("SUBMITTED")) return "SUBMITTED";
  return "DRAFT";
}

async function backfillBatches() {
  const rows = await prisma.result.findMany({
    where: { batchId: null },
    include: { student: { select: { classId: true } } },
  });

  const groups = new Map<string, typeof rows>();
  let skipped = 0;
  for (const r of rows) {
    if (!r.student.classId) {
      skipped++;
      continue;
    }
    const key = [r.student.classId, r.templateId, r.term, r.session].join("|");
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  let created = 0;
  for (const group of groups.values()) {
    const first = group[0];
    const classId = first.student.classId!;
    const template = await prisma.resultTemplate.findUniqueOrThrow({ where: { id: first.templateId }, select: { currentVersionId: true } });
    const submittedAt = group.map((r) => r.submittedAt).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

    await prisma.$transaction(async (tx) => {
      const batch = await tx.resultBatch.upsert({
        where: { classId_templateId_term_session: { classId, templateId: first.templateId, term: first.term, session: first.session } },
        create: {
          schoolId: first.schoolId,
          classId,
          templateId: first.templateId,
          templateVersionId: template.currentVersionId,
          term: first.term,
          termNumber: termNumberFromLabel(first.term),
          session: first.session,
          status: derivedStatus(group.map((r) => r.status)),
          submittedByUserId: group.find((r) => r.submittedByUserId)?.submittedByUserId ?? null,
          submittedAt,
        },
        update: {},
      });
      await tx.result.updateMany({ where: { id: { in: group.map((r) => r.id) } }, data: { batchId: batch.id } });
    }, TX);
    created++;
  }
  console.log(`Batches: linked ${created} group(s); skipped ${skipped} result(s) whose student has no class.`);
}

async function backfillSnapshots() {
  const published = await prisma.result.findMany({
    where: { status: "PUBLISHED", snapshots: { none: {} } },
    include: {
      template: true,
      student: { include: { class: true, campus: true } },
      school: { select: { name: true, slug: true } },
      batch: { select: { templateVersionId: true } },
    },
  });

  let made = 0;
  for (const r of published) {
    const fields = Array.isArray(r.template.fields) ? (r.template.fields as unknown as TemplateField[]) : [];
    const publishedAt = r.publishedAt ?? r.updatedAt;

    for (let attempt = 0; ; attempt++) {
      const verificationCode = generateVerificationCode();
      const payload = buildSnapshotPayload({
        school: r.school,
        student: {
          name: `${r.student.firstName} ${r.student.lastName}`,
          code: r.student.studentCode,
          className: r.student.class?.name ?? "—",
          campusName: r.student.campus.name,
        },
        period: { session: r.session, term: r.term },
        template: { id: r.templateId, name: r.template.name, versionId: r.batch?.templateVersionId ?? null, fields },
        data: (r.data as Record<string, string>) ?? {},
        publication: { version: 1, verificationCode, publishedAt },
      });
      try {
        await prisma.publishedResultSnapshot.create({
          data: {
            schoolId: r.schoolId,
            resultId: r.id,
            batchId: r.batchId,
            studentId: r.studentId,
            version: 1,
            payload: payload as unknown as Prisma.InputJsonValue,
            checksum: snapshotChecksum(payload),
            verificationCode,
            templateVersionId: r.batch?.templateVersionId ?? null,
            publishedByUserId: r.approvedByUserId,
            publishedAt,
          },
        });
        made++;
        break;
      } catch (err) {
        const clash = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && attempt < 2;
        if (!clash) throw err;
      }
    }
  }
  console.log(`Snapshots: created ${made} for previously published result(s).`);
}

async function backfillEvents() {
  const batches = await prisma.resultBatch.findMany({
    where: { status: "PUBLISHED" },
    include: { results: { select: { approvedByUserId: true } } },
  });
  let made = 0;
  for (const b of batches) {
    const existing = await prisma.resultEvent.count({ where: { batchId: b.id, action: "PUBLISHED" } });
    if (existing > 0) continue;
    await prisma.resultEvent.create({
      data: {
        schoolId: b.schoolId,
        batchId: b.id,
        action: "PUBLISHED",
        actorUserId: b.results.find((r) => r.approvedByUserId)?.approvedByUserId ?? null,
        actorRole: "SCHOOL_ADMIN",
        templateVersionId: b.templateVersionId,
        metadata: { backfilled: true, students: b.results.length },
      },
    });
    made++;
  }
  console.log(`Events: recorded ${made} backfilled PUBLISHED event(s).`);
}

async function main() {
  await backfillBatches();
  await backfillSnapshots();
  await backfillEvents();
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
