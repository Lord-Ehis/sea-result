import { describe, expect, it } from "vitest";
import { computeAnnualSummaries, gradeForAverage, weightsAreValid, type AnnualSettings, type AnnualStudentInput } from "@/lib/annual-summary";
import { BANDS } from "./fixtures";

const remarksMap = BANDS.map((b) => ({ grade: b.label, remarks: `r-${b.label}` }));
const subjects = [
  { id: "math", name: "Maths" },
  { id: "eng", name: "English" },
];
const equal: AnnualSettings = { weights: { 1: 33.33, 2: 33.33, 3: 33.34 }, policy: "BLOCK", showPosition: false };
const skew: AnnualSettings = { ...equal, weights: { 1: 25, 2: 25, 3: 50 } };
const calc: AnnualSettings = { ...equal, policy: "CALCULATE_AVAILABLE" };

const earlier = (t: 1 | 2, math: string, eng?: string) => ({ termNumber: t, resultId: `r${t}`, snapshotId: `s${t}`, snapshotVersion: 1, totals: { math, eng } });
const run = (settings: AnnualSettings, students: AnnualStudentInput[]) => computeAnnualSummaries({ subjects, gradeBands: BANDS, remarksMap, settings, students });
const student = (o: Partial<AnnualStudentInput> = {}): AnnualStudentInput => ({
  studentId: "a",
  resultId: "r3",
  term3Totals: { math: "90", eng: "60" },
  earlier: [earlier(1, "60", "50"), earlier(2, "75", "70")],
  exceptions: [],
  ...o,
});
const r4 = (n: number) => String(Math.round(n * 1e4) / 1e4);

describe("annual weighting (RT-09)", () => {
  it("weights each term and keeps the sources", () => {
    const [r] = run(equal, [student()]);
    const math = r.annual!.subjects[0];
    expect(math.average).toBe(r4((60 * 33.33 + 75 * 33.33 + 90 * 33.34) / 100));
    expect([math.t1, math.t2, math.t3]).toEqual(["60", "75", "90"]);
    expect(r.annual!.sources.map((s) => `${s.termNumber}:${s.snapshotId}`)).toEqual(["1:s1", "2:s2", "3:null"]);
    expect(r.annual!.weights).toEqual({ t1: 33.33, t2: 33.33, t3: 33.34 });
  });
  it("honours custom weights (25/25/50)", () => {
    const [r] = run(skew, [student()]);
    expect(r.annual!.subjects[0].average).toBe(String((60 * 25 + 75 * 25 + 90 * 50) / 100));
  });
  it("keeps fractional totals", () => {
    const [r] = run(equal, [student({ term3Totals: { math: "87.5", eng: "60" } })]);
    expect(r.annual!.subjects[0].t3).toBe("87.5");
  });
  it("averages the subject averages for the overall result", () => {
    const [r] = run(skew, [student()]);
    const avgs = r.annual!.subjects.map((s) => Number(s.average));
    expect(Number(r.annual!.overall.average)).toBeCloseTo((avgs[0] + avgs[1]) / 2, 4);
  });
  it("adds remarks from the grade", () => {
    expect(run(equal, [student()])[0].annual!.subjects[0].remarks).toMatch(/^r-/);
  });
});

describe("missing earlier term (RT-10)", () => {
  it("BLOCK: reports a blocker, never a zero", () => {
    const [r] = run(equal, [student({ earlier: [earlier(2, "75", "70")] })]);
    expect(r.blockers).toHaveLength(1);
    expect(r.blockers[0]).toContain("1st Term");
    expect(r.annual).toBeNull();
  });
  it("CALCULATE_AVAILABLE: rescales over the terms present and labels it incomplete", () => {
    const [r] = run(calc, [student({ earlier: [earlier(2, "75", "70")] })]);
    expect(r.annual!.incomplete).toBe(true);
    expect(r.annual!.subjects[0].average).toBe(r4((75 * 33.33 + 90 * 33.34) / 66.67));
    expect(r.annual!.note).toBe("Based on 2nd Term and 3rd Term");
    expect(r.annual!.subjects[0].t1).toBeNull();
  });
  it("not enrolled: excluded (not zero), no blocker, not incomplete", () => {
    const [r] = run(equal, [student({ earlier: [earlier(2, "75", "70")], exceptions: [{ termNumber: 1, status: "NOT_ENROLLED" }] })]);
    expect(r.blockers).toHaveLength(0);
    expect(r.annual!.incomplete).toBe(false);
    expect(r.annual!.subjects[0].average).toBe(r4((75 * 33.33 + 90 * 33.34) / 66.67));
    expect(r.termStates.t1).toBe("not_enrolled");
  });
  it("exempt is recorded as exempt", () => {
    const [r] = run(equal, [student({ earlier: [earlier(2, "75", "70")], exceptions: [{ termNumber: 1, status: "EXEMPT" }] })]);
    expect(r.termStates.t1).toBe("exempt");
  });
  it("a subject absent from an earlier term is not applicable for that term", () => {
    const [r] = run(equal, [student({ earlier: [earlier(1, "60"), earlier(2, "75", "70")] })]);
    const eng = r.annual!.subjects[1];
    expect(eng.t1).toBeNull();
    expect(eng.average).toBe(r4((70 * 33.33 + 60 * 33.34) / 66.67));
  });
});

describe("grades and positions", () => {
  it("grades an average that sits between whole-number bands", () => {
    expect(gradeForAverage(69.5, BANDS)).toBe("B");
    expect(gradeForAverage(70, BANDS)).toBe("A");
    expect(gradeForAverage(39.9, BANDS)).toBe("F");
    expect(gradeForAverage(-1, BANDS)).toBe("");
  });
  it("ranks with ties, and leaves out incomplete students", () => {
    const pos: AnnualSettings = { ...calc, showPosition: true };
    const mk = (id: string, m: string, earl = [earlier(1, m, m), earlier(2, m, m)]) =>
      student({ studentId: id, resultId: id, term3Totals: { math: m, eng: m }, earlier: earl });
    const out = run(pos, [mk("a", "90"), mk("b", "80"), mk("c", "80"), mk("d", "70"), mk("inc", "99", [earlier(2, "99", "99")])]);
    expect(out.map((o) => `${o.studentId}:${o.annual!.position}`)).toEqual(["a:1st", "b:2nd", "c:2nd", "d:4th", "inc:null"]);
  });
  it("shows no position when the school has it off", () => {
    expect(run(equal, [student()])[0].annual!.position).toBeNull();
  });
});

describe("weights", () => {
  it("must total 100", () => {
    expect(weightsAreValid(equal.weights)).toBe(true);
    expect(weightsAreValid(skew.weights)).toBe(true);
    expect(weightsAreValid({ 1: 30, 2: 30, 3: 30 })).toBe(false);
    expect(weightsAreValid({ 1: -10, 2: 60, 3: 50 })).toBe(false);
  });
});
