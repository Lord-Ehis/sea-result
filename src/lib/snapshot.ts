import { createHash, randomInt } from "node:crypto";
import type { TemplateField } from "@/app/admin/result-templates/actions";
import { buildGridResultData, gradingScaleLegend, performanceSummary, type GridResultData, type GradingScaleLegendEntry, type PerformanceSummary } from "@/lib/grid-compute";
import { buildRatingGridData, type RatingGridData } from "@/lib/rating-grid";
import type { AnnualSummaryPayload } from "@/lib/annual-summary";

// A published result, frozen. The payload is self-contained — every label,
// value and table structure a parent sees is baked in — so editing the
// template afterwards cannot change what was published. `fields` and `grids`
// are the same shapes the parent dashboard and lookup already render.

export type SnapshotSchool = {
  name: string;
  slug: string;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  supportEmail?: string | null;
};

export type SnapshotStudent = {
  name: string;
  code: string;
  className: string;
  campusName: string;
  gender?: string | null;
  admissionNumber?: string | null;
  dateOfBirth?: string | null;
  age?: number | null;
  height?: string | null;
  weight?: string | null;
  favouriteColour?: string | null;
  clubOrSociety?: string | null;
  photoUrl?: string | null;
};

export type SnapshotPayload = {
  schemaVersion: 1;
  school: SnapshotSchool;
  student: SnapshotStudent;
  period: { session: string; term: string };
  template: { id: string; name: string; versionId: string | null };
  fields: { name: string; value: string }[];
  grids: GridResultData[];
  // Categorised "Rating scale" fields (Affective/Psychomotor domain etc.) as
  // a checkbox-style grid — absent when the template has none.
  ratingGrids?: RatingGridData[];
  // Total obtained / obtainable / percentage / grade across the grid's
  // subjects — absent when there is nothing to summarise.
  performanceSummary?: PerformanceSummary;
  // The template's grade bands/remarks at publish time, for a "Grade Scale"
  // legend — absent when the template has no Grid field or no bands set.
  gradingScale?: GradingScaleLegendEntry[];
  // Only on a 3rd Term result of an annual-enabled template. Part of the
  // checksummed payload, so the weights and sources it was built from are
  // frozen with it.
  annual?: AnnualSummaryPayload;
  publication: { version: number; verificationCode: string; publishedAt: string; amendedAt?: string };
};

export function buildSnapshotPayload(input: {
  school: SnapshotSchool;
  student: SnapshotStudent;
  period: { session: string; term: string };
  template: { id: string; name: string; versionId: string | null; fields: TemplateField[] };
  data: Record<string, string>;
  annual?: AnnualSummaryPayload | null;
  publication: { version: number; verificationCode: string; publishedAt: Date; amendedAt?: Date };
}): SnapshotPayload {
  const { template, data } = input;
  const gradingScale = gradingScaleLegend(template.fields);
  const ratingGrids = buildRatingGridData(template.fields, data);
  const summary = performanceSummary(template.fields, data);
  return {
    schemaVersion: 1,
    school: input.school,
    student: input.student,
    period: input.period,
    template: { id: template.id, name: template.name, versionId: template.versionId },
    // Grid fields have no single value (their cells live under composite
    // keys) — they're carried separately in `grids`. Categorised rating
    // fields are carried in `ratingGrids` instead of this flat list.
    fields: template.fields
      .filter((f) => f.type !== "Grid" && !(f.type === "Rating scale" && f.ratingCategory))
      .map((f) => ({ name: f.name, value: data[f.id] ?? "—" })),
    grids: buildGridResultData(template.fields, data),
    ...(summary ? { performanceSummary: summary } : {}),
    // Absent when the template has no categorised rating fields.
    ...(ratingGrids.length > 0 ? { ratingGrids } : {}),
    // Absent when the template's Grid has no configured bands.
    ...(gradingScale.length > 0 ? { gradingScale } : {}),
    // Absent (not null) when there's no annual summary, so snapshots without
    // one keep exactly the shape — and checksum — they were published with.
    ...(input.annual ? { annual: input.annual } : {}),
    publication: {
      version: input.publication.version,
      verificationCode: input.publication.verificationCode,
      publishedAt: input.publication.publishedAt.toISOString(),
      ...(input.publication.amendedAt ? { amendedAt: input.publication.amendedAt.toISOString() } : {}),
    },
  };
}

// Key-sorted JSON, so the checksum doesn't depend on key order (Postgres JSONB
// doesn't preserve it).
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function snapshotChecksum(payload: unknown): string {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

export function isSnapshotIntact(snapshot: { payload: unknown; checksum: string }): boolean {
  return snapshotChecksum(snapshot.payload) === snapshot.checksum;
}

// No 0/O/1/I so a code read aloud or copied by hand isn't ambiguous.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** e.g. R7K4-P2M9 — 32^8 possibilities. */
export function generateVerificationCode(): string {
  const pick = () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  const half = () => Array.from({ length: 4 }, pick).join("");
  return `${half()}-${half()}`;
}

export function normalizeVerificationCode(input: string): string {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.length === 8 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}` : cleaned;
}
