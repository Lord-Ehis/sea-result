import { describe, expect, it } from "vitest";
import { computeOwnFields } from "@/lib/template-compute";
import { computePublishData } from "@/lib/publish-compute";
import { expandThisTermFields } from "@/lib/grid-compute";
import { pickAllowedData, validateStudentEntry } from "@/lib/result-validate";
import { buildScoreSheet, parseScoreSheet } from "@/lib/score-csv";
import { fullEntry, makeGridTemplate } from "./fixtures";

// Spec §9: "A class of 100 students × 20 subjects × 6 components should
// validate without a visible UI freeze." The budgets are generous on purpose
// (a slow CI box must not flake) yet far below anything a person would notice.
const STUDENTS = 100;
const fields = makeGridTemplate(20, 6);
const expanded = expandThisTermFields(fields);
const rows = Array.from({ length: STUDENTS }, (_, i) => ({ id: `u${i}`, name: `Student ${i}`, studentCode: `S-${i}`, data: fullEntry(20, 6, (s, c) => ((s * 7 + c * 3 + i) % 10) + 1) }));

describe("100 students × 20 subjects × 6 components", () => {
  it("validates the whole class quickly", () => {
    const start = performance.now();
    for (const r of rows) {
      const v = validateStudentEntry(fields, pickAllowedData(fields, r.data));
      expect(v.errors).toEqual([]);
      expect(v.missing).toEqual([]);
    }
    expect(performance.now() - start).toBeLessThan(1500);
  });

  it("recomputes totals and grades for the whole class quickly", () => {
    const start = performance.now();
    for (const r of rows) computeOwnFields(expanded, r.data);
    expect(performance.now() - start).toBeLessThan(1500);
  });

  it("re-validating one edited student (a keystroke) is effectively instant", () => {
    const start = performance.now();
    for (let i = 0; i < 20; i++) {
      validateStudentEntry(fields, pickAllowedData(fields, rows[0].data));
      computeOwnFields(expanded, rows[0].data);
    }
    expect((performance.now() - start) / 20).toBeLessThan(50);
  });

  it("computes publish-time positions for the whole class quickly", () => {
    const start = performance.now();
    const out = computePublishData(rows.map((r) => ({ studentId: r.id, session: "2025/2026", data: r.data })), fields, []);
    expect(out).toHaveLength(STUDENTS);
    expect(performance.now() - start).toBeLessThan(3000);
  });

  it("builds and re-imports a sheet quickly", () => {
    const byStudent = Object.fromEntries(rows.map((r) => [r.id, r.data]));
    const start = performance.now();
    const csv = buildScoreSheet(fields, rows, byStudent);
    const out = parseScoreSheet(csv, fields, rows);
    expect(out.errors).toEqual([]);
    expect(out.rowsApplied).toBe(STUDENTS);
    expect(performance.now() - start).toBeLessThan(3000);
  });
});
