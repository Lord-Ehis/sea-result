"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { GridResultData } from "@/lib/grid-compute";
import { isSnapshotIntact, type SnapshotPayload } from "@/lib/snapshot";
import type { AnnualSummaryPayload } from "@/lib/annual-summary";
import { signSnapshotToken } from "@/lib/snapshot-token";

const lookupSchema = z.object({
  slug: z.string().trim().min(1),
  studentCode: z.string().trim().min(1),
  fullName: z.string().trim().min(1),
});

export type LookupResult = {
  found: boolean;
  studentName?: string;
  results?: {
    templateId: string;
    templateName: string;
    term: string | null;
    session: string | null;
    snapshotId: string;
    verificationCode: string;
    // Opens this one result's printable page for a short time — the lookup
    // has no login, so this is its proof that the viewer passed code + name.
    printToken: string;
    intact: boolean;
    fields: { name: string; value: string }[];
    grids: GridResultData[];
    annual: AnnualSummaryPayload | null;
  }[];
};

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function lookupStudentResult(input: { slug: string; studentCode: string; fullName: string }): Promise<LookupResult> {
  const parsed = lookupSchema.parse(input);

  const school = await prisma.school.findFirst({
    where: { slug: parsed.slug, status: "ACTIVE", allowResultLookup: true },
  });
  if (!school) return { found: false };

  const student = await prisma.student.findFirst({
    where: { schoolId: school.id, studentCode: { equals: parsed.studentCode, mode: "insensitive" } },
  });
  if (!student) return { found: false };

  const fullName = normalizeName(`${student.firstName} ${student.lastName}`);
  if (fullName !== normalizeName(parsed.fullName)) return { found: false };

  // The frozen snapshot, not the live template — see the parent dashboard.
  const snapshots = await prisma.publishedResultSnapshot.findMany({
    where: { studentId: student.id, supersededAt: null },
    orderBy: { publishedAt: "desc" },
  });

  return {
    found: true,
    studentName: `${student.firstName} ${student.lastName}`,
    results: snapshots.map((snap) => {
      const payload = snap.payload as unknown as SnapshotPayload;
      const intact = isSnapshotIntact(snap);
      return {
        templateId: payload.template.id,
        templateName: payload.template.name,
        term: payload.period.term,
        session: payload.period.session ?? null,
        snapshotId: snap.id,
        verificationCode: snap.verificationCode,
        printToken: signSnapshotToken(snap.id),
        intact,
        fields: intact ? payload.fields : [],
        grids: intact ? payload.grids : [],
        annual: intact ? (payload.annual ?? null) : null,
      };
    }),
  };
}
