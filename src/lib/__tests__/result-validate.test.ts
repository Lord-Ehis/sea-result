import { describe, expect, it } from "vitest";
import { pickAllowedData, validateSingleValue, validateStudentEntry } from "@/lib/result-validate";
import { gridKey } from "@/lib/grid-compute";
import { fullEntry, makeGridTemplate } from "./fixtures";

const fields = makeGridTemplate(2, 2);
const k = (s: number, c: number) => gridKey("grid", `s${s}`, `c${c}`);

describe("entry validation (RT-04, RT-05)", () => {
  it("accepts a complete entry", () => {
    const v = validateStudentEntry(fields, fullEntry(2, 2));
    expect(v.errors).toEqual([]);
    expect(v.missing).toEqual([]);
  });
  it("rejects a score above the component maximum", () => {
    const v = validateStudentEntry(fields, { ...fullEntry(2, 2), [k(0, 0)]: "11" });
    expect(v.errors.map((e) => e.key)).toEqual([k(0, 0)]);
  });
  it("rejects negative and non-numeric scores", () => {
    expect(validateStudentEntry(fields, { ...fullEntry(2, 2), [k(0, 0)]: "-1" }).errors).toHaveLength(1);
    expect(validateStudentEntry(fields, { ...fullEntry(2, 2), [k(0, 0)]: "abc" }).errors).toHaveLength(1);
  });
  it("reports a blank required score as missing, not as an error or zero", () => {
    const data = fullEntry(2, 2);
    delete data[k(1, 1)];
    const v = validateStudentEntry(fields, data);
    expect(v.errors).toEqual([]);
    expect(v.missing.map((e) => e.key)).toEqual([k(1, 1)]);
  });
  it("treats absent as complete", () => {
    const data = fullEntry(2, 2);
    data[k(0, 1)] = "";
    data[`${k(0, 1)}#state`] = "absent";
    expect(validateStudentEntry(fields, data).missing).toEqual([]);
  });
  it("rejects an unknown status", () => {
    expect(validateStudentEntry(fields, { ...fullEntry(2, 2), [`${k(0, 0)}#state`]: "gone" }).errors).toHaveLength(1);
  });
});

describe("single values and stray keys", () => {
  it("validates one cell", () => {
    expect(validateSingleValue(fields, k(0, 0), "5")).toBeNull();
    expect(validateSingleValue(fields, k(0, 0), "50")).toMatch(/between 0 and 10/);
    expect(validateSingleValue(fields, "nope", "1")).toMatch(/can't be edited/);
    expect(validateSingleValue(fields, `${k(0, 0)}#state`, "absent")).toBeNull();
  });
  it("drops computed and unknown keys", () => {
    const picked = pickAllowedData(fields, { ...fullEntry(2, 2), [gridKey("grid", "s0", "termTotal")]: "99", junk: "x" });
    expect(Object.keys(picked).sort()).toEqual(Object.keys(fullEntry(2, 2)).sort());
  });
});
