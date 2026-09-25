import { describe, expect, it } from "vitest";
import { gradeAnalysis, gridKey } from "@/lib/grid-compute";
import { computeWeightedTotal, computeOwnFields } from "@/lib/template-compute";
import { buildSnapshotPayload } from "@/lib/snapshot";
import { compileVersionToFields, REMARK_TEACHER_ID, REMARK_PRINCIPAL_ID } from "@/lib/version-compile";
import type { TemplateField } from "@/app/admin/result-templates/actions";

const grid: TemplateField = {
  id: "g",
  name: "Academic performance",
  type: "Grid",
  grid: {
    subjects: [
      { id: "s1", name: "English" },
      { id: "s2", name: "Maths" },
      { id: "s3", name: "Biology" },
      { id: "s4", name: "Civic" },
    ],
    rawColumns: [{ id: "ex", name: "Exam", maxMark: 100 }],
    gradeBands: [
      { min: 0, max: 49, label: "F" },
      { min: 50, max: 69, label: "B" },
      { min: 70, max: 100, label: "A" },
    ],
    remarksMap: [],
    includeCumulative: false,
  },
};
const cell = (s: string, k: string) => gridKey("g", s, k);
const data = {
  [cell("s1", "termTotal")]: "80",
  [cell("s1", "grade")]: "A",
  [cell("s2", "termTotal")]: "75",
  [cell("s2", "grade")]: "A",
  [cell("s3", "termTotal")]: "55",
  [cell("s3", "grade")]: "B",
  // s4 unscored / exempted: not offered
  [cell("s4", "termTotal")]: "",
  [cell("s4", "grade")]: "",
};

const base = {
  school: { name: "S", slug: "s" },
  student: { name: "A", studentCode: "1" },
  period: { term: "Term 1", academicYear: "2026/2027", className: "JSS 1" },
  publication: { verificationCode: "X", publishedAt: new Date("2026-01-01T00:00:00.000Z"), version: 1 },
};

describe("gradeAnalysis", () => {
  it("counts this student's subjects per grade (highest first, zeros kept) and subjects offered", () => {
    expect(gradeAnalysis([grid], data)).toEqual({
      counts: [
        { grade: "A", count: 2 },
        { grade: "B", count: 1 },
        { grade: "F", count: 0 },
      ],
      totalSubjects: 3,
    });
  });
  it("is null with no grid, no bands or nothing scored", () => {
    expect(gradeAnalysis([], data)).toBeNull();
    expect(gradeAnalysis([grid], {})).toBeNull();
    expect(gradeAnalysis([{ ...grid, grid: { ...grid.grid!, gradeBands: [] } }], data)).toBeNull();
  });
  it("is carried on the snapshot payload", () => {
    const payload = buildSnapshotPayload({ ...base, template: { id: "t", name: "T", versionId: null, fields: [grid] }, data } as never);
    expect(payload.gradeAnalysis?.totalSubjects).toBe(3);
  });
});

describe("remarks and rating legend", () => {
  const input = { legacyGridFieldId: null, legacyFields: [], sections: [], ratingCategories: [], resolvedGradingScale: null };
  it("compiles the two remark fields only when the switch is on", () => {
    expect(compileVersionToFields(input)).toHaveLength(0);
    expect(compileVersionToFields({ ...input, includeRemarks: true }).map((f) => f.id)).toEqual([REMARK_TEACHER_ID, REMARK_PRINCIPAL_ID]);
  });
  it("puts written remarks on the payload, not in the flat field list", () => {
    const fields = compileVersionToFields({ ...input, includeRemarks: true });
    const payload = buildSnapshotPayload({ ...base, template: { id: "t", name: "T", versionId: null, fields }, data: { [REMARK_TEACHER_ID]: " Bright pupil ", [REMARK_PRINCIPAL_ID]: "" } } as never);
    expect(payload.remarks).toEqual({ teacher: "Bright pupil" });
    expect(payload.fields).toEqual([]);
  });
  it("carries rating meanings through to the rating grid only when set", () => {
    const category = { id: "c", name: "Affective", displayOrder: 0, ratingOptions: ["5", "4"], items: [{ id: "i", legacySourceId: null, name: "Honesty", isEnabled: true }] };
    const withMeanings = compileVersionToFields({ ...input, ratingCategories: [{ ...category, ratingMeanings: ["Excellent", "High"] }] });
    const plain = compileVersionToFields({ ...input, ratingCategories: [{ ...category, ratingMeanings: ["", ""] }] });
    const grids = buildSnapshotPayload({ ...base, template: { id: "t", name: "T", versionId: null, fields: withMeanings }, data: {} } as never).ratingGrids;
    expect(grids?.[0].meanings).toEqual(["Excellent", "High"]);
    expect(buildSnapshotPayload({ ...base, template: { id: "t", name: "T", versionId: null, fields: plain }, data: {} } as never).ratingGrids?.[0].meanings).toBeUndefined();
  });
});

describe("a subject with nothing entered", () => {
  const parts = [{ key: "ca", max: 40, weight: 40 }, { key: "ex", max: 60, weight: 60 }];
  it("has no total or grade instead of a zero and an F", () => {
    expect(computeWeightedTotal(parts, {})).toBe("");
    expect(computeWeightedTotal(parts, { ca: "20", ex: "30" })).toBe("50");
    expect(computeWeightedTotal(parts, { "ca#state": "absent", "ex#state": "absent" })).toBe("0");
    const fields: TemplateField[] = [
      { id: "t", name: "Total", type: "Computed", formula: { kind: "weightedSum", parts } },
      { id: "g", name: "Grade", type: "Computed", formula: { kind: "grade", of: "t", bands: [{ min: 0, max: 100, label: "F" }] } },
    ];
    expect(computeOwnFields(fields, {}).g).toBe("");
  });
});
