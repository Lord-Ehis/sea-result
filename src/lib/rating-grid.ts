import type { TemplateField } from "@/app/admin/result-templates/actions";

// Groups a template's flat "Rating scale" fields back into their parent
// category (Affective domain, Psychomotor domain, ...) for a checkbox-style
// grid — rows are traits, columns are the category's rating options, one
// per student's answer. Only fields with a ratingCategoryId (set by
// compileVersionToFields) are grouped; a rating field with none (an older,
// never-migrated field) is left out here and keeps rendering as a plain row
// in the flat fields list instead.
//
// Grouped by id, not name — two categories can share a name (nothing
// enforces uniqueness), and merging their items under one heading would
// silently mix two different option sets, dropping or misplacing checkmarks
// for whichever category isn't first.

export type RatingGridData = {
  categoryId: string;
  categoryName: string;
  options: string[];
  items: { id: string; name: string; value: string }[];
};

export function buildRatingGridData(fields: TemplateField[], data: Record<string, string>): RatingGridData[] {
  const order: string[] = [];
  const grouped = new Map<string, TemplateField[]>();
  for (const f of fields) {
    if (f.type !== "Rating scale" || !f.ratingCategoryId) continue;
    if (!grouped.has(f.ratingCategoryId)) {
      grouped.set(f.ratingCategoryId, []);
      order.push(f.ratingCategoryId);
    }
    grouped.get(f.ratingCategoryId)!.push(f);
  }
  return order.map((categoryId) => {
    const items = grouped.get(categoryId)!;
    return {
      categoryId,
      categoryName: items[0]?.ratingCategory ?? "",
      options: items[0]?.ratingOptions ?? [],
      items: items.map((f) => ({ id: f.id, name: f.name, value: data[f.id] ?? "" })),
    };
  });
}
