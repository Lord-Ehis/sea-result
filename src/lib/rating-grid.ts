import type { TemplateField } from "@/app/admin/result-templates/actions";

// Groups a template's flat "Rating scale" fields back into their parent
// category (Affective domain, Psychomotor domain, ...) for a checkbox-style
// grid — rows are traits, columns are the category's rating options, one
// per student's answer. Only fields with a ratingCategory (set by
// compileVersionToFields) are grouped; a rating field with none (an older,
// never-migrated field) is left out here and keeps rendering as a plain row
// in the flat fields list instead.

export type RatingGridData = {
  categoryName: string;
  options: string[];
  items: { id: string; name: string; value: string }[];
};

export function buildRatingGridData(fields: TemplateField[], data: Record<string, string>): RatingGridData[] {
  const order: string[] = [];
  const grouped = new Map<string, TemplateField[]>();
  for (const f of fields) {
    if (f.type !== "Rating scale" || !f.ratingCategory) continue;
    if (!grouped.has(f.ratingCategory)) {
      grouped.set(f.ratingCategory, []);
      order.push(f.ratingCategory);
    }
    grouped.get(f.ratingCategory)!.push(f);
  }
  return order.map((categoryName) => {
    const items = grouped.get(categoryName)!;
    return {
      categoryName,
      options: items[0]?.ratingOptions ?? [],
      items: items.map((f) => ({ id: f.id, name: f.name, value: data[f.id] ?? "" })),
    };
  });
}
