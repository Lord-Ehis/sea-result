import { describe, expect, it } from "vitest";
import type { TemplateField } from "@/app/admin/result-templates/actions";
import { computeOwnFields, computePositions, computeClassAverages, computeWeightedTotal } from "@/lib/template-compute";
import { expandForPublish, expandThisTermFields, gridKey } from "@/lib/grid-compute";
import { gradeForValue } from "@/lib/grade-lookup";
import { BANDS, makeGridTemplate } from "./fixtures";

describe("weighted totals", () => {
  const parts = [
    { key: "ca", max: 40, weight: 40 },
    { key: "exam", max: 60, weight: 60 },
  ];
  it("sums raw ÷ max × weight", () => {
    expect(computeWeightedTotal(parts, { ca: "30", exam: "45" })).toBe("75");
  });
  it("keeps four decimals", () => {
    const uneven = [
      { key: "ca", max: 30, weight: 40 },
      { key: "exam", max: 70, weight: 60 },
    ];
    expect(computeWeightedTotal(uneven, { ca: "20", exam: "47" })).toBe("66.9524");
  });
  it("counts absent as zero without renormalising", () => {
    expect(computeWeightedTotal(parts, { ca: "40", exam: "", "exam#state": "absent" })).toBe("40");
  });
  it("drops exempted parts and rescales the rest to 100", () => {
    expect(computeWeightedTotal(parts, { ca: "20", "exam#state": "exempted" })).toBe("50");
  });
  it("has no total when every part is exempted", () => {
    expect(computeWeightedTotal(parts, { "ca#state": "exempted", "exam#state": "exempted" })).toBe("");
  });
});

describe("grade lookup", () => {
  it("matches exact bands", () => {
    expect(gradeForValue(45, BANDS)).toBe("D");
    expect(gradeForValue(70, BANDS)).toBe("A");
    expect(gradeForValue(100, BANDS)).toBe("A");
  });
  it("grades a fractional total that falls between whole-number bands (69.5, 39.9)", () => {
    expect(gradeForValue(69.5, BANDS)).toBe("B");
    expect(gradeForValue(39.9, BANDS)).toBe("F");
    expect(gradeForValue(59.99, BANDS)).toBe("C");
  });
  it("gives no grade outside the scale", () => {
    expect(gradeForValue(-1, BANDS)).toBe("");
    expect(gradeForValue(100.5, BANDS)).toBe("");
    expect(gradeForValue(50, [])).toBe("");
  });
  it("is what the grid grade formula uses", () => {
    const fields = makeGridTemplate(1, 1);
    // one component, max 10, weight 100: a raw 6.95 out of 10 is a 69.5 total
    const out = computeOwnFields(expandThisTermFields(fields), { [gridKey("grid", "s0", "c0")]: "6.95" });
    expect(out[gridKey("grid", "s0", "termTotal")]).toBe("69.5");
    expect(out[gridKey("grid", "s0", "grade")]).toBe("B");
  });
});

describe("positions (RT-11)", () => {
  const fields: TemplateField[] = [{ id: "pos", name: "Position", type: "Computed", formula: { kind: "position", of: "total" } }];
  it("uses standard competition ranking (1st, 2nd, 2nd, 4th)", () => {
    const out = computePositions(fields, [{ total: "90" }, { total: "80" }, { total: "80" }, { total: "70" }]);
    expect(out.map((d) => d.pos)).toEqual(["1st", "2nd", "2nd", "4th"]);
  });
  it("gives students with no numeric total a dash", () => {
    const out = computePositions(fields, [{ total: "90" }, { total: "" }]);
    expect(out.map((d) => d.pos)).toEqual(["1st", "—"]);
  });
  it("handles 11th, 12th and 13th", () => {
    const data = Array.from({ length: 13 }, (_, i) => ({ total: String(100 - i) }));
    const out = computePositions(fields, data);
    expect([out[10].pos, out[11].pos, out[12].pos]).toEqual(["11th", "12th", "13th"]);
  });
});

describe("class averages (RT-11 follow-up)", () => {
  const fields: TemplateField[] = [{ id: "avg", name: "Class Average", type: "Computed", formula: { kind: "classAverage", of: "total" } }];
  it("gives every student the same mean, to two decimals", () => {
    const out = computeClassAverages(fields, [{ total: "90" }, { total: "80" }, { total: "70" }]);
    expect(out.map((d) => d.avg)).toEqual(["80.00", "80.00", "80.00"]);
  });
  it("excludes students with no numeric total from both the sum and the count", () => {
    const out = computeClassAverages(fields, [{ total: "90" }, { total: "" }, { total: "70" }]);
    expect(out.map((d) => d.avg)).toEqual(["80.00", "80.00", "80.00"]);
  });
  it("is a dash when nobody has a numeric total", () => {
    const out = computeClassAverages(fields, [{ total: "" }, { total: "" }]);
    expect(out.map((d) => d.avg)).toEqual(["—", "—"]);
  });
});

describe("publish expansion", () => {
  it("adds a per-subject position field for a grid template", () => {
    const ids = expandForPublish(makeGridTemplate(2, 2)).map((f) => f.id);
    expect(ids).toContain(gridKey("grid", "s1", "subjectPosition"));
  });
  it("adds a per-subject class average field for a grid template", () => {
    const ids = expandForPublish(makeGridTemplate(2, 2)).map((f) => f.id);
    expect(ids).toContain(gridKey("grid", "s1", "classAverage"));
  });
});
