import { describe, expect, it } from "vitest";
import { classGradeAnalysis, gridKey } from "@/lib/grid-compute";
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
      { id: "s3", name: "Unused" },
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
const student = (english: string, maths: string) => ({
  [gridKey("g", "s1", "termTotal")]: english,
  [gridKey("g", "s2", "termTotal")]: maths,
});
// overall: 80% A, 75% A, 55% B, 20% F, and one student with no scores at all
const cls = [student("80", "80"), student("70", "80"), student("50", "60"), student("20", "20"), {}];

describe("classGradeAnalysis", () => {
  it("counts students per overall grade (highest first, zeros kept) and subjects the class offered", () => {
    expect(classGradeAnalysis([grid], cls)).toEqual({
      counts: [
        { grade: "A", count: 2 },
        { grade: "B", count: 1 },
        { grade: "F", count: 1 },
      ],
      totalStudents: 4,
      totalSubjects: 2,
    });
  });
  it("is null with no grid, no bands or nothing scored", () => {
    expect(classGradeAnalysis([], cls)).toBeNull();
    expect(classGradeAnalysis([grid], [{}])).toBeNull();
    expect(classGradeAnalysis([{ ...grid, grid: { ...grid.grid!, gradeBands: [] } }], cls)).toBeNull();
  });
  it("is frozen on the payload when passed in, and absent otherwise", () => {
    const base = {
      school: { name: "S", slug: "s" },
      student: { name: "A", studentCode: "1" },
      period: { term: "Term 1", academicYear: "2026/2027", className: "JSS 1" },
      template: { id: "t", name: "T", versionId: null, fields: [grid] },
      data: cls[0],
      publication: { verificationCode: "X", publishedAt: new Date("2026-01-01T00:00:00.000Z"), version: 1 },
    };
    const analysis = classGradeAnalysis([grid], cls);
    expect(buildSnapshotPayload({ ...base, gradeAnalysis: analysis } as never).gradeAnalysis?.totalStudents).toBe(4);
    expect(buildSnapshotPayload(base as never).gradeAnalysis).toBeUndefined();
  });
});
