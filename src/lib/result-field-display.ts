import type { TemplateField } from "@/app/admin/result-templates/actions";

// Position and class average both need the whole class's batch; cumulative
// needs prior terms' published history. None is available during live
// entry/review — all three only get a value once the batch is actually
// published. Shared by ResultEntryClient and ReviewClient (previously
// duplicated in both).
export function computedAtPublish(field: TemplateField): boolean {
  return field.formula?.kind === "position" || field.formula?.kind === "classAverage" || field.formula?.kind === "cumulative";
}
