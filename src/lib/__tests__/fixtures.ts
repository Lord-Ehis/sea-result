import type { GradeBand, TemplateField } from "@/app/admin/result-templates/actions";
import { gridKey } from "@/lib/grid-compute";

export const BANDS: GradeBand[] = [
  { min: 0, max: 39, label: "F" },
  { min: 40, max: 49, label: "D" },
  { min: 50, max: 59, label: "C" },
  { min: 60, max: 69, label: "B" },
  { min: 70, max: 100, label: "A" },
];

/** A weighted grid template: `subjects` subjects × `components` components, weights summing to 100 per subject. */
export function makeGridTemplate(subjects: number, components: number): TemplateField[] {
  const weight = 100 / components;
  return [
    {
      id: "grid",
      name: "Academic performance",
      type: "Grid",
      grid: {
        subjects: Array.from({ length: subjects }, (_, i) => ({ id: `s${i}`, name: `Subject ${i + 1}` })),
        rawColumns: Array.from({ length: components }, (_, i) => ({ id: `c${i}`, name: `Part ${i + 1}`, maxMark: 10, weight, required: true })),
        gradeBands: BANDS,
        remarksMap: BANDS.map((b) => ({ grade: b.label, remarks: `remark ${b.label}` })),
        includeCumulative: false,
        weighted: true,
      },
    },
  ];
}

/** Complete, valid raw data for one student of `makeGridTemplate`. */
export function fullEntry(subjects: number, components: number, score = (s: number, c: number) => ((s + c) % 10) + 1): Record<string, string> {
  const data: Record<string, string> = {};
  for (let s = 0; s < subjects; s++) for (let c = 0; c < components; c++) data[gridKey("grid", `s${s}`, `c${c}`)] = String(score(s, c));
  return data;
}
