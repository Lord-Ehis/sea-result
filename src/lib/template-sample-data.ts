import type { TemplateField } from "@/app/admin/result-templates/actions";
import { ratingOptionsFor, DROPDOWN_OPTIONS } from "@/lib/field-options";

// Believable-looking raw entries for a template's own (non-Computed) fields,
// so a live preview has something to show before anyone has entered real
// data. Pure and deterministic — same fields always render the same sample,
// so the preview doesn't jitter as an admin edits an unrelated field.
//
// Varies a subject's score by its position so the preview reads as a real
// class (not every subject scoring identically) while staying comfortably
// inside a typical grading scale's top bands.
export function sampleDataFor(fields: TemplateField[]): Record<string, string> {
  const data: Record<string, string> = {};

  for (const field of fields) {
    if (field.type === "Grid" && field.grid) {
      field.grid.subjects.forEach((subject, si) => {
        // 72–96% of each column's max, nudged per subject so totals differ.
        const ratio = 0.72 + ((si * 7) % 25) / 100;
        for (const column of field.grid!.rawColumns) {
          const key = `${field.id}:${subject.id}:${column.id}`;
          data[key] = String(Math.max(0, Math.round(column.maxMark * ratio)));
        }
      });
    } else if (field.type === "Rating scale") {
        const options = ratingOptionsFor(field);
        // Skews toward the better end of the scale (index 0), like a real class.
        data[field.id] = options[Math.abs(hash(field.id)) % Math.min(2, options.length)] ?? options[0] ?? "";
    } else if (field.type === "Number") {
      if (field.attendance === "opened") data[field.id] = "150";
      else if (field.attendance === "present") data[field.id] = "143";
      else data[field.id] = "85";
    } else if (field.type === "Dropdown") {
      data[field.id] = DROPDOWN_OPTIONS[0] ?? "";
    } else if (field.type === "Text") {
      data[field.id] =
        field.remark === "teacher"
          ? "A bright, diligent and studious student. Always inquisitive and ready to learn."
          : field.remark === "principal"
            ? "A pleasing result. Keep up the good work."
            : "Sample text";
    }
    // Computed fields are left out — computePublishData fills them in from
    // the raw entries above, the same way a real publish does.
  }

  return data;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
