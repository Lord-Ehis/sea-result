import type { TemplateField } from "@/app/admin/result-templates/actions";

export const DROPDOWN_OPTIONS = ["Excellent", "Very Good", "Good", "Fair", "Poor"];

// The original fixed scale, before Rating scale fields had any config —
// still the fallback for fields created before this was configurable.
export const LEGACY_RATING_OPTIONS = ["1", "2", "3", "4", "5"];

// Seeded on newly-created Rating scale fields — matches a typical
// Affective/Psychomotor domain scale (e.g. Neatness, Punctuality).
export const DEFAULT_NEW_RATING_OPTIONS = ["Excellent", "Very Good", "Good", "Poor", "Very Poor"];

export function ratingOptionsFor(field: Pick<TemplateField, "ratingOptions">): string[] {
  return field.ratingOptions && field.ratingOptions.length > 0 ? field.ratingOptions : LEGACY_RATING_OPTIONS;
}
