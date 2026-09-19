import { prisma } from "@/lib/prisma";

// Which template a class enters results against: the most specific scope wins
// (this class → its level → all classes). Within a scope, a template that
// went through the versioned builder beats a legacy one, then oldest first,
// so the answer is stable instead of whatever the database returned first.
export async function resolveTemplateForClass(schoolId: string, klass: { id: string; level: string | null }) {
  const scopes = [
    { classId: klass.id },
    ...(klass.level ? [{ classId: null, level: klass.level }] : []),
    { classId: null, level: null },
  ];

  for (const scope of scopes) {
    const candidates = await prisma.resultTemplate.findMany({
      where: { schoolId, isActive: true, ...scope },
      orderBy: { createdAt: "asc" },
    });
    if (candidates.length === 0) continue;
    return [...candidates].sort((a, b) => Number(!!b.currentVersionId) - Number(!!a.currentVersionId))[0];
  }
  return null;
}
