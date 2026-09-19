import { prisma } from "@/lib/prisma";

// The spec's Appendix A suggested default grading scale — illustrative and
// fully configurable by each school, but seeded once per school so a brand
// new draft has a sensible fallback scale to resolve against.
export const DEFAULT_GRADING_SCALE_BANDS = [
  { minScore: 70, maxScore: 100, gradeCode: "A", remark: "Excellent", displayOrder: 0 },
  { minScore: 60, maxScore: 69.99, gradeCode: "B", remark: "Very good", displayOrder: 1 },
  { minScore: 50, maxScore: 59.99, gradeCode: "C", remark: "Good", displayOrder: 2 },
  { minScore: 45, maxScore: 49.99, gradeCode: "D", remark: "Fair", displayOrder: 3 },
  { minScore: 40, maxScore: 44.99, gradeCode: "E", remark: "Pass", displayOrder: 4 },
  { minScore: 0, maxScore: 39.99, gradeCode: "F", remark: "Needs improvement", displayOrder: 5 },
];

/** Idempotent — seeds the school's default grading scale once, if it doesn't already have one. */
export async function ensureDefaultGradingScale(schoolId: string): Promise<string> {
  const existing = await prisma.gradingScale.findFirst({ where: { schoolId, isDefault: true } });
  if (existing) return existing.id;

  const created = await prisma.gradingScale.create({
    data: {
      schoolId,
      name: "Default grading scale",
      isDefault: true,
      bands: { create: DEFAULT_GRADING_SCALE_BANDS.map((b) => ({ schoolId, ...b })) },
    },
  });
  return created.id;
}
