"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { TemplateField } from "@/app/admin/result-templates/actions";

const lookupSchema = z.object({
  slug: z.string().trim().min(1),
  studentCode: z.string().trim().min(1),
  fullName: z.string().trim().min(1),
});

export type LookupResult = {
  found: boolean;
  studentName?: string;
  results?: {
    templateName: string;
    term: string | null;
    fields: { name: string; value: string }[];
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

  const publishedResults = await prisma.result.findMany({
    where: { studentId: student.id, status: "PUBLISHED" },
    include: { template: true },
    orderBy: { publishedAt: "desc" },
  });

  return {
    found: true,
    studentName: `${student.firstName} ${student.lastName}`,
    results: publishedResults.map((r) => ({
      templateName: r.template.name,
      term: r.term,
      fields: (Array.isArray(r.template.fields) ? (r.template.fields as unknown as TemplateField[]) : []).map((f) => ({
        name: f.name,
        value: (r.data as Record<string, string>)?.[f.id] ?? "—",
      })),
    })),
  };
}
