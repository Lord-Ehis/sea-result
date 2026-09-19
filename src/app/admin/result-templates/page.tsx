import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TemplateBuilderClient } from "./TemplateBuilderClient";
import { listGradingScales } from "./version-actions";
import type { TemplateField } from "./actions";

export default async function ResultTemplatesPage() {
  const session = await auth();
  const schoolId = session!.user.schoolId!;

  const [templates, classes, gradingScales] = await Promise.all([
    prisma.resultTemplate.findMany({
      where: { schoolId },
      include: { class: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.class.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    listGradingScales(),
  ]);

  const levels = Array.from(new Set(classes.map((c) => c.level).filter((l): l is string => !!l))).sort();

  return (
    <TemplateBuilderClient
      initialTemplates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        classId: t.classId,
        className: t.class?.name ?? null,
        level: t.level,
        term: t.term,
        fields: Array.isArray(t.fields) ? (t.fields as unknown as TemplateField[]) : [],
      }))}
      classes={classes.map((c) => ({ id: c.id, name: c.name }))}
      levels={levels}
      initialGradingScales={gradingScales}
    />
  );
}
