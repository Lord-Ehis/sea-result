import type { TemplateField, GradeBand, GridConfig, GridRemarksEntry } from "@/app/admin/result-templates/actions";

// Compiles a structured TemplateVersion (sections/components/grading
// scale/rating categories) into the legacy TemplateField[] shape stored on
// ResultTemplate.fields, so entry/review/publish and the whole compute
// engine (template-compute.ts, grid-compute.ts) keep reading exactly what
// they read today — this function is the only thing that has to change for
// "activate a version" to become real, non-cosmetic behaviour.
//
// Pure — no DB/env access — so the same function backs both activateVersion
// and a live in-progress-draft preview action.

export type CompileComponent = {
  id: string;
  legacySourceId: string | null;
  componentName: string;
  componentCode: string;
  maxScore: number;
  displayOrder: number;
};
export type CompileSection = {
  id: string;
  legacySourceId: string | null;
  name: string;
  displayOrder: number;
  components: CompileComponent[];
};
export type CompileRatingItem = {
  id: string;
  legacySourceId: string | null;
  name: string;
  isEnabled: boolean;
};
export type CompileRatingCategory = {
  displayOrder: number;
  ratingOptions: string[];
  items: CompileRatingItem[];
};
export type CompileGradingScale = {
  bands: { minScore: number; maxScore: number; gradeCode: string; remark: string }[];
};

export type CompileVersionInput = {
  legacyGridFieldId: string | null;
  legacyFields: TemplateField[];
  sections: CompileSection[];
  ratingCategories: CompileRatingCategory[];
  resolvedGradingScale: CompileGradingScale | null;
};

// The legacy Grid model has ONE shared score-column list applied to every
// subject (grid.rawColumns), but a version's sections/components allow a
// different component set per section. We reconcile by grouping components
// across every section by componentCode — the first section (in display
// order) that defines a code supplies its column id/name/max, so a
// migrated version (whose sections all share the same codes, by
// construction) round-trips exactly, while a version an admin later makes
// asymmetric still compiles (subjects missing a code simply have a blank
// cell for it) rather than failing.
function buildSharedRawColumns(sections: CompileSection[]): GridConfig["rawColumns"] {
  const sorted = [...sections].sort((a, b) => a.displayOrder - b.displayOrder);
  const byCode = new Map<string, GridConfig["rawColumns"][number] & { order: number }>();

  for (const section of sorted) {
    const components = [...section.components].sort((a, b) => a.displayOrder - b.displayOrder);
    for (const c of components) {
      if (byCode.has(c.componentCode)) continue;
      byCode.set(c.componentCode, {
        id: c.legacySourceId ?? c.id,
        name: c.componentName,
        maxMark: c.maxScore,
        order: c.displayOrder,
      });
    }
  }

  return Array.from(byCode.values())
    .sort((a, b) => a.order - b.order)
    .map(({ id, name, maxMark }) => ({ id, name, maxMark }));
}

function buildGrid(input: CompileVersionInput): GridConfig {
  const sortedSections = [...input.sections].sort((a, b) => a.displayOrder - b.displayOrder);
  const bands = input.resolvedGradingScale?.bands ?? [];
  const gradeBands: GradeBand[] = bands
    .slice()
    .sort((a, b) => a.minScore - b.minScore)
    .map((b) => ({ min: b.minScore, max: b.maxScore, label: b.gradeCode }));
  const remarksMap: GridRemarksEntry[] = bands.map((b) => ({ grade: b.gradeCode, remarks: b.remark }));

  return {
    subjects: sortedSections.map((s) => ({ id: s.legacySourceId ?? s.id, name: s.name })),
    rawColumns: buildSharedRawColumns(input.sections),
    gradeBands,
    remarksMap,
    // Cumulative Result columns are a later-phase (annual summary)
    // concern; this increment never turns this on for a compiled version.
    includeCumulative: false,
  };
}

export function compileVersionToFields(input: CompileVersionInput): TemplateField[] {
  const fields: TemplateField[] = [];

  if (input.sections.length > 0) {
    fields.push({
      id: input.legacyGridFieldId ?? "grid-field",
      name: "Academic performance",
      type: "Grid",
      grid: buildGrid(input),
    });
  }

  for (const category of [...input.ratingCategories].sort((a, b) => a.displayOrder - b.displayOrder)) {
    for (const item of category.items) {
      if (!item.isEnabled) continue;
      fields.push({
        id: item.legacySourceId ?? item.id,
        name: item.name,
        type: "Rating scale",
        ratingOptions: category.ratingOptions,
      });
    }
  }

  return [...fields, ...input.legacyFields];
}
