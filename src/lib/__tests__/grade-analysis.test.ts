import { describe, expect, it } from "vitest";
import { gradeAnalysis, gridKey } from "@/lib/grid-compute";
import { buildSnapshotPayload } from "@/lib/snapshot";
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

describe("gradeAnalysis", () => {
  it("counts subjects per grade (highest first, zeros kept) and subjects offered", () => {
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
    const payload = buildSnapshotPayload({
      school: { name: "S", slug: "s" },
      student: { name: "A", studentCode: "1" },
      period: { term: "Term 1", academicYear: "2026/2027", className: "JSS 1" },
      template: { id: "t", name: "T", versionId: null, fields: [grid] },
      data,
      publication: { verificationCode: "X", publishedAt: new Date("2026-01-01T00:00:00.000Z"), version: 1 },
    } as never);
    expect(payload.gradeAnalysis?.totalSubjects).toBe(3);
  });
});
