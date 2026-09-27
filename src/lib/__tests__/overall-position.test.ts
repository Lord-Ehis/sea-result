import { describe, expect, it } from "vitest";
import { computeOverallPositions, gridKey, performanceSummary } from "@/lib/grid-compute";
import { computePublishData } from "@/lib/publish-compute";
import type { TemplateField } from "@/app/admin/result-templates/actions";

const grid: TemplateField = {
  id: "g",
  name: "Academic performance",
  type: "Grid",
  grid: {
    subjects: [
      { id: "s1", name: "English" },
      { id: "s2", name: "Maths" },
    ],
    rawColumns: [{ id: "ex", name: "Exam", maxMark: 100 }],
    gradeBands: [{ min: 0, max: 100, label: "A" }],
    remarksMap: [],
    includeCumulative: false,
  },
};
const cell = (s: string) => gridKey("g", s, "termTotal");
// percentages: 90, 90 (tied 1st), 70 (3rd, rank skips 2nd), no score at all (unranked)
const students = [
  { [cell("s1")]: "90", [cell("s2")]: "90" },
  { [cell("s1")]: "90", [cell("s2")]: "90" },
  { [cell("s1")]: "70", [cell("s2")]: "70" },
  {},
];

describe("computeOverallPositions", () => {
  it("ranks by overall percentage, ties share a rank and the next rank skips ahead", () => {
    const result = computeOverallPositions([grid], students);
    expect(result.map((d) => d["overall-position"])).toEqual(["1st", "1st", "3rd", "—"]);
  });
  it("is absent from performanceSummary until it's been computed", () => {
    expect(performanceSummary([grid], students[0])?.position).toBeUndefined();
  });
  it("is picked up by performanceSummary once written into the data", () => {
    const [ranked] = computeOverallPositions([grid], students);
    expect(performanceSummary([grid], ranked)?.position).toBe("1st");
  });
});

describe("computePublishData", () => {
  it("fills in each student's overall class position alongside everything else", () => {
    // Raw exam scores this time, not termTotal directly — computePublishData
    // computes termTotal itself (like a real publish), so a pre-set
    // termTotal alone would just be overwritten from the (missing) raw score.
    // Blank components still resolve to a real 0 total (same as a Subject
    // Position or Class Average would see), so the last student ranks last
    // rather than being left out — only a template with no Grid at all
    // (nothing to rank by) gets "—".
    const rawCell = (s: string) => gridKey("g", s, "ex");
    const rawStudents = [
      { [rawCell("s1")]: "90", [rawCell("s2")]: "90" },
      { [rawCell("s1")]: "90", [rawCell("s2")]: "90" },
      { [rawCell("s1")]: "70", [rawCell("s2")]: "70" },
      {},
    ];
    const rows = rawStudents.map((data, i) => ({ studentId: `s${i}`, session: "2026/2027", data }));
    const result = computePublishData(rows, [grid], []);
    expect(result.map((d) => d["overall-position"])).toEqual(["1st", "1st", "3rd", "4th"]);
  });
  it("is '—' for every student when the template has no Grid to rank by", () => {
    const rows = [{ studentId: "s1", session: "2026/2027", data: { field: "10" } }];
    const flatField: TemplateField = { id: "field", name: "Score", type: "Number" };
    const result = computePublishData(rows, [flatField], []);
    expect(result[0]["overall-position"]).toBe("—");
  });
});
