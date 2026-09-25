import { z } from "zod";
import { fieldSchema, type TemplateField } from "./field-schemas";

// Client-facing shapes for the version editor. Rows carry a client-generated
// id (crypto.randomUUID(), same convention as Grid subjects/columns in
// actions.ts) from the moment they're added in the UI — matched against the
// DB on save to tell "already exists, update it" from "new, create it"
// apart, without a separate temp-id scheme.

export type AssessmentComponentInput = {
  id: string;
  componentName: string;
  componentCode: string;
  maxScore: number;
  weightPercent: number;
  displayOrder: number;
  isRequired: boolean;
};

export type SectionInput = {
  id: string;
  name: string;
  displayOrder: number;
  components: AssessmentComponentInput[];
};

export type RatingItemInput = {
  id: string;
  name: string;
  displayOrder: number;
  isEnabled: boolean;
};

export type RatingCategoryInput = {
  id: string;
  name: string;
  displayOrder: number;
  ratingOptions: string[];
  // What each option means, by index; optional.
  ratingMeanings?: string[];
  items: RatingItemInput[];
};

export type GradingScaleBandInput = {
  minScore: number;
  maxScore: number;
  gradeCode: string;
  remark: string;
  displayOrder: number;
};

export type GradingScaleSummary = {
  id: string;
  name: string;
  isDefault: boolean;
  bands: GradingScaleBandInput[];
};

export type TemplateVersionSummary = {
  id: string;
  versionNumber: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  gradingScaleId: string | null;
  createdAt: string;
  activatedAt: string | null;
  sections: SectionInput[];
  ratingCategories: RatingCategoryInput[];
  legacyFields: TemplateField[];
  includeAnnualSummary: boolean;
  includeAttendance: boolean;
  includeRemarks: boolean;
};

export const PRESETS = {
  "simple-40-60": {
    label: "Simple 40/60",
    components: [
      { componentName: "Continuous assessment", componentCode: "CA", maxScore: 40, weightPercent: 40 },
      { componentName: "Examination", componentCode: "EXAM", maxScore: 60, weightPercent: 60 },
    ],
  },
  "four-part-ca-exam": {
    label: "Four-part CA + exam",
    components: [
      { componentName: "CA1", componentCode: "CA1", maxScore: 10, weightPercent: 10 },
      { componentName: "CA2", componentCode: "CA2", maxScore: 10, weightPercent: 10 },
      { componentName: "Assignment", componentCode: "ASSIGN", maxScore: 10, weightPercent: 10 },
      { componentName: "Project", componentCode: "PROJECT", maxScore: 10, weightPercent: 10 },
      { componentName: "Examination", componentCode: "EXAM", maxScore: 60, weightPercent: 60 },
    ],
  },
  "three-part-secondary": {
    label: "Three-part secondary",
    components: [
      { componentName: "Test", componentCode: "TEST", maxScore: 20, weightPercent: 20 },
      { componentName: "Project", componentCode: "PROJECT", maxScore: 20, weightPercent: 20 },
      { componentName: "Examination", componentCode: "EXAM", maxScore: 60, weightPercent: 60 },
    ],
  },
} as const;

export type PresetKey = keyof typeof PRESETS;

const componentSchema = z.object({
  id: z.string().min(1),
  componentName: z.string().trim().min(1),
  componentCode: z.string().trim().min(1),
  maxScore: z.number().nonnegative(),
  weightPercent: z.number().nonnegative(),
  displayOrder: z.number().int(),
  isRequired: z.boolean(),
});

export const sectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  displayOrder: z.number().int(),
  components: z.array(componentSchema),
});

const ratingItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  displayOrder: z.number().int(),
  isEnabled: z.boolean(),
});

export const ratingCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  displayOrder: z.number().int(),
  ratingOptions: z.array(z.string()),
  ratingMeanings: z.array(z.string()).default([]),
  items: z.array(ratingItemSchema),
});

export const updateVersionDraftSchema = z.object({
  versionId: z.string().min(1),
  gradingScaleId: z.string().nullable(),
  sections: z.array(sectionSchema),
  ratingCategories: z.array(ratingCategorySchema),
  legacyFields: z.array(fieldSchema),
  includeAnnualSummary: z.boolean().default(false),
  includeAttendance: z.boolean().default(false),
  includeRemarks: z.boolean().default(false),
});
