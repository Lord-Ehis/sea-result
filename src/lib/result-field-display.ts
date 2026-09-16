import type { TemplateField } from "@/app/admin/result-templates/actions";

// Position needs the whole class's batch; cumulative needs prior terms'
// published history. Neither is available during live entry/review — both
// only get a value once the batch is actually published. Shared by
// ResultEntryClient and ReviewClient (previously duplicated in both).
export function computedAtPublish(field: TemplateField): boolean {
  return field.formula?.kind === "position" || field.formula?.kind === "cumulative";
}
