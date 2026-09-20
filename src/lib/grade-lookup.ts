import type { GradeBand } from "@/app/admin/result-templates/field-schemas";

/**
 * The grade a value falls in. A band matches when min ≤ value ≤ max; for a
 * value that sits *between* bands (a weighted total of 69.5 with bands 60–69
 * and 70–100 — whole-number boundaries leave those gaps) the highest band
 * whose minimum it reaches is used. Below the lowest minimum, or above the
 * top band's maximum, there is no grade.
 */
export function gradeForValue(value: number, bands: GradeBand[]): string {
  if (!Number.isFinite(value) || bands.length === 0) return "";
  const exact = bands.find((b) => value >= b.min && value <= b.max);
  if (exact) return exact.label;
  const topMax = Math.max(...bands.map((b) => b.max));
  if (value > topMax) return "";
  const reached = [...bands].sort((a, b) => b.min - a.min).find((b) => value >= b.min);
  return reached?.label ?? "";
}
