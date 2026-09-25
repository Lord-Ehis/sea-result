import { requireFullAdminPage } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { TemplateBuilderClient } from "./TemplateBuilderClient";
import { listGradingScales } from "./version-actions";
import type { TemplateField } from "./actions";
import { loadAnnualSettings } from "@/lib/annual-context";

export default async function ResultTemplatesPage() {
  const { schoolId } = await requireFullAdminPage();

  const [templates, classes, gradingScales, annualSettings, school] = await Promise.all([
    prisma.resultTemplate.findMany({
      where: { schoolId },
      include: { class: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.class.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    listGradingScales(),
    loadAnnualSettings(schoolId),
    prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      select: { name: true, slug: true, logoUrl: true, address: true, phone: true, supportEmail: true, principalName: true, principalSignatureUrl: true, stampUrl: true, nextTermBegins: true },
    }),
  ]);

  const levels = Array.from(new Set(classes.map((c) => c.level).filter((l): l is string => !!l))).sort();

  return (
    <TemplateBuilderClient
      // Real school profile, so the live preview's header/sign-off look
      // exactly like a published result's — no separate set of placeholders
      // to keep in sync with the school profile page.
      school={{ ...school, nextTermBegins: school.nextTermBegins ? school.nextTermBegins.toISOString().slice(0, 10) : null }}
      initialTemplates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        classId: t.classId,
        className: t.class?.name ?? null,
        level: t.level,
        term: t.term,
        termNumber: t.termNumber,
        fields: Array.isArray(t.fields) ? (t.fields as unknown as TemplateField[]) : [],
      }))}
      classes={classes.map((c) => ({ id: c.id, name: c.name }))}
      levels={levels}
      initialGradingScales={gradingScales}
      annualSettings={annualSettings}
    />
  );
}
