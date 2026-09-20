import { prisma } from "@/lib/prisma";
import type { TemplateField } from "@/app/admin/result-templates/actions";

/**
 * The template fields a result was published with. A correction must use
 * these — the template as it was — not the template's current fields, which
 * a newer activated version may since have reshaped (weights, subjects).
 * Templates that never went through the versioned builder use the live fields.
 */
export async function fieldsAsPublished(templateVersionId: string | null, liveTemplateFields: unknown): Promise<TemplateField[]> {
  const version = templateVersionId
    ? await prisma.templateVersion.findUnique({ where: { id: templateVersionId }, select: { compiledFieldsSnapshot: true } })
    : null;
  const source = Array.isArray(version?.compiledFieldsSnapshot) ? version!.compiledFieldsSnapshot : liveTemplateFields;
  return (Array.isArray(source) ? source : []) as unknown as TemplateField[];
}
