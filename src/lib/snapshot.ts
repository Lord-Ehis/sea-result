import { createHash, randomInt } from "node:crypto";
import type { TemplateField } from "@/app/admin/result-templates/actions";
import { buildGridResultData, type GridResultData } from "@/lib/grid-compute";

// A published result, frozen. The payload is self-contained — every label,
// value and table structure a parent sees is baked in — so editing the
// template afterwards cannot change what was published. `fields` and `grids`
// are the same shapes the parent dashboard and lookup already render.

export type SnapshotPayload = {
  schemaVersion: 1;
  school: { name: string; slug: string };
  student: { name: string; code: string; className: string; campusName: string };
  period: { session: string; term: string };
  template: { id: string; name: string; versionId: string | null };
  fields: { name: string; value: string }[];
  grids: GridResultData[];
  publication: { version: number; verificationCode: string; publishedAt: string };
};

export function buildSnapshotPayload(input: {
  school: { name: string; slug: string };
  student: { name: string; code: string; className: string; campusName: string };
  period: { session: string; term: string };
  template: { id: string; name: string; versionId: string | null; fields: TemplateField[] };
  data: Record<string, string>;
  publication: { version: number; verificationCode: string; publishedAt: Date };
}): SnapshotPayload {
  const { template, data } = input;
  return {
    schemaVersion: 1,
    school: input.school,
    student: input.student,
    period: input.period,
    template: { id: template.id, name: template.name, versionId: template.versionId },
    // Grid fields have no single value (their cells live under composite
    // keys) — they're carried separately in `grids`.
    fields: template.fields.filter((f) => f.type !== "Grid").map((f) => ({ name: f.name, value: data[f.id] ?? "—" })),
    grids: buildGridResultData(template.fields, data),
    publication: {
      version: input.publication.version,
      verificationCode: input.publication.verificationCode,
      publishedAt: input.publication.publishedAt.toISOString(),
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
