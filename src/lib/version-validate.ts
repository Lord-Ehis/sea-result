// Validates a TemplateVersion's draft configuration before it can be
// activated (spec acceptance criterion RT-02: invalid weights must block
// activation and name the exact failing section). Pure — called by both a
// UI-facing "validate" action and, non-negotiably, by activateVersion
// itself server-side (never trust client-only validation).

const WEIGHT_SUM_TOLERANCE = 0.01;

export type ValidateComponent = { componentName: string; componentCode: string; weightPercent: number };
export type ValidateSection = { name: string; components: ValidateComponent[] };
export type ValidateGradingScale = { bands: { minScore: number; maxScore: number }[] } | null;

export type ValidationIssue = { message: string };
export type ValidationResult = { errors: ValidationIssue[]; warnings: ValidationIssue[] };

export function validateVersionConfig(input: {
  sections: ValidateSection[];
  gradingScale: ValidateGradingScale;
}): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (input.sections.length === 0) {
    warnings.push({ message: "No subjects/sections configured yet." });
  }

  for (const section of input.sections) {
    if (section.components.length === 0) {
      errors.push({ message: `"${section.name}" has no assessment components.` });
      continue;
    }

    const weightSum = section.components.reduce((sum, c) => sum + c.weightPercent, 0);
    if (Math.abs(weightSum - 100) > WEIGHT_SUM_TOLERANCE) {
      errors.push({
        message: `"${section.name}"'s components sum to ${weightSum.toFixed(2)}%, not 100%.`,
      });
    }

    const codeCounts = new Map<string, number>();
    for (const c of section.components) {
      codeCounts.set(c.componentCode, (codeCounts.get(c.componentCode) ?? 0) + 1);
    }
    for (const [code, count] of codeCounts) {
      if (count > 1) {
        errors.push({ message: `"${section.name}" has duplicate component code "${code}".` });
      }
    }
  }

  if (input.gradingScale) {
    const bands = [...input.gradingScale.bands].sort((a, b) => a.minScore - b.minScore);
    if (bands.length === 0) {
      errors.push({ message: "The selected grading scale has no bands." });
    }
    for (let i = 0; i < bands.length; i++) {
      const band = bands[i];
      if (band.minScore > band.maxScore) {
        errors.push({ message: `Grading scale band ${i + 1} has a minimum above its maximum.` });
      }
      const next = bands[i + 1];
      if (next && next.minScore <= band.maxScore) {
        errors.push({ message: `Grading scale bands overlap between ${band.maxScore} and ${next.minScore}.` });
      } else if (next && next.minScore > band.maxScore + 0.01) {
        warnings.push({ message: `Grading scale has a gap between ${band.maxScore} and ${next.minScore}.` });
      }
    }
    if (bands.length > 0 && bands[0].minScore > 0) {
      warnings.push({ message: `Grading scale doesn't cover scores below ${bands[0].minScore}.` });
    }
    if (bands.length > 0 && bands[bands.length - 1].maxScore < 100) {
      warnings.push({ message: `Grading scale doesn't cover scores above ${bands[bands.length - 1].maxScore}.` });
    }
  } else {
    warnings.push({ message: "No grading scale selected — the school's default scale will be used." });
  }

  return { errors, warnings };
}
