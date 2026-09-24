import { z } from "zod";

// Types + Zod schemas for the legacy TemplateField[] shape (ResultTemplate
// .fields / TemplateVersion.legacyFields). Kept in a plain module rather
// than in actions.ts, because a "use server" file may only export async
// functions — not types or const schemas — and both actions.ts and
// version-types.ts need these.

export type GradeBand = { min: number; max: number; label: string };
export type GridSubject = { id: string; name: string };
// `weight` (percent) and `required` are only set on columns compiled from an
// activated template version; older templates leave them undefined and keep
// summing raw marks.
export type GridRawColumn = { id: string; name: string; maxMark: number; weight?: number; required?: boolean };
export type GridRemarksEntry = { grade: string; remarks: string };
export type WeightedPart = { key: string; max: number; weight: number };
export type GridConfig = {
  subjects: GridSubject[];
  rawColumns: GridRawColumn[];
  gradeBands: GradeBand[];
  remarksMap: GridRemarksEntry[];
  // Gates the Cumulative Result columns (First/Second/Third Term,
  // Cumulative Total/Average/Grade/Remarks/Position) — a later round.
  includeCumulative: boolean;
  // True when every column carries a weight: the subject total becomes
  // sum(raw / max × weight) instead of a flat sum of raw marks.
  weighted?: boolean;
  // Term 3 only: also show the annual summary (see src/lib/annual-summary.ts).
  annualSummary?: boolean;
};
export type ComputedFormula =
  | { kind: "sum"; of: string[] }
  | { kind: "weightedSum"; parts: WeightedPart[] }
  | { kind: "average"; of: string[] }
  | { kind: "grade"; of: string; bands: GradeBand[] }
  | { kind: "position"; of: string }
  // The mean of `of` across every student in the batch — the same value for
  // every student, unlike position. Publish-time only, like position.
  | { kind: "classAverage"; of: string }
  | { kind: "cumulative"; of: string; aggregate: "sum" | "average" }
  | { kind: "remarksLookup"; of: string; map: GridRemarksEntry[] }
  | {
      kind: "promotion";
      subjectFields: string[];
      compulsoryFields: string[];
      passMark: number;
      minOffered: number;
      minPassed: number;
      overallField: string;
      promotionScore: number;
    }
  // `of` is the id of a "promotion"-kind field on the same template —
  // reuses that field's criteria as the single source of truth rather than
  // duplicating pass mark/minimums/etc. Produces a multi-line (\n-joined)
  // narrative explaining the verdict, e.g. a report card's "Result
  // Analysis (Criteria for passing)" section.
  | { kind: "resultAnalysis"; of: string };
export type TemplateField = {
  id: string;
  name: string;
  type: "Number" | "Text" | "Dropdown" | "Rating scale" | "Computed" | "Grid";
  formula?: ComputedFormula;
  // Present iff type === "Grid" — a subjects × columns table (e.g. the
  // Cognitive Domain section of a Nigerian report card), stored as one
  // TemplateField so it slots into the existing flat-field list; its cell
  // values live in Result.data under composite keys (see src/lib/grid-compute.ts).
  grid?: GridConfig;
  // Only meaningful for type === "Rating scale". Undefined on older fields
  // (created before this was configurable) — falls back to the original
  // fixed 1-5 scale everywhere it's read, so already-published "3"s keep
  // meaning "3 of 5" rather than being silently reinterpreted.
  ratingOptions?: string[];
  // Only meaningful for type === "Rating scale" — the parent RatingCategory's
  // name (e.g. "Affective domain"), set by compileVersionToFields so items
  // can be regrouped into a rating grid at render time. Undefined for a
  // rating field with no category (older/legacy fields), which renders as a
  // plain row instead of being grouped.
  ratingCategory?: string;
  // The category's own id — used to group items (names aren't guaranteed
  // unique; two categories can share a name).
  ratingCategoryId?: string;
};

export const gradeBandSchema = z.object({ min: z.number(), max: z.number(), label: z.string() });
export const gridRemarksEntrySchema = z.object({ grade: z.string(), remarks: z.string() });
export const formulaSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("sum"), of: z.array(z.string()) }),
  z.object({
    kind: z.literal("weightedSum"),
    parts: z.array(z.object({ key: z.string(), max: z.number(), weight: z.number() })),
  }),
  z.object({ kind: z.literal("average"), of: z.array(z.string()) }),
  z.object({ kind: z.literal("grade"), of: z.string(), bands: z.array(gradeBandSchema) }),
  z.object({ kind: z.literal("position"), of: z.string() }),
  z.object({ kind: z.literal("classAverage"), of: z.string() }),
  z.object({ kind: z.literal("cumulative"), of: z.string(), aggregate: z.enum(["sum", "average"]) }),
  z.object({ kind: z.literal("remarksLookup"), of: z.string(), map: z.array(gridRemarksEntrySchema) }),
  z.object({
    kind: z.literal("promotion"),
    subjectFields: z.array(z.string()),
    compulsoryFields: z.array(z.string()),
    passMark: z.number(),
    minOffered: z.number(),
    minPassed: z.number(),
    overallField: z.string(),
    promotionScore: z.number(),
  }),
  z.object({ kind: z.literal("resultAnalysis"), of: z.string() }),
]);

export const gridConfigSchema = z.object({
  subjects: z.array(z.object({ id: z.string(), name: z.string() })),
  rawColumns: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      maxMark: z.number(),
      weight: z.number().optional(),
      required: z.boolean().optional(),
    }),
  ),
  gradeBands: z.array(gradeBandSchema),
  remarksMap: z.array(gridRemarksEntrySchema),
  includeCumulative: z.boolean(),
  weighted: z.boolean().optional(),
  annualSummary: z.boolean().optional(),
});

export const fieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["Number", "Text", "Dropdown", "Rating scale", "Computed", "Grid"]),
  formula: formulaSchema.optional(),
  grid: gridConfigSchema.optional(),
  ratingOptions: z.array(z.string()).optional(),
  ratingCategory: z.string().optional(),
  ratingCategoryId: z.string().optional(),
});
