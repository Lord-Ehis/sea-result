import { describe, expect, it } from "vitest";
import { buildErrorReport, buildScoreSheet, parseCsv, parseScoreSheet, scoreColumns, toCsv } from "@/lib/score-csv";
import { gridKey } from "@/lib/grid-compute";
import { fullEntry, makeGridTemplate } from "./fixtures";

const fields = makeGridTemplate(2, 2);
const students = [
  { id: "u1", name: "Ada Okafor", studentCode: "S-001" },
  { id: "u2", name: "Bayo Adeyemi", studentCode: "S-002" },
];
const k = (s: number, c: number) => gridKey("grid", `s${s}`, `c${c}`);
const H = scoreColumns(fields).map((c) => c.header);

describe("csv text", () => {
  it("round-trips quotes, commas and newlines", () => {
    const rows = [["a", 'b "quoted", with comma', "line1\nline2"], ["", "x", "y"]];
    expect(parseCsv(toCsv(rows))).toEqual([["a", 'b "quoted", with comma', "line1\nline2"], ["", "x", "y"]]);
  });
  it("handles a BOM, CRLF and blank lines", () => {
    expect(parseCsv("﻿a,b\r\n\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("reads semicolon-separated files", () => {
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("neutralises formulas in exported cells", () => {
    expect(toCsv([["=SUM(A1)"]])).toBe("'=SUM(A1)");
  });
});

describe("score sheet download", () => {
  it("has a column for every entered cell and pre-fills current values and states", () => {
    const data = { u1: { ...fullEntry(2, 2), [k(0, 1)]: "", [`${k(0, 1)}#state`]: "absent" } };
    const rows = parseCsv(buildScoreSheet(fields, students, data));
    expect(rows[0]).toEqual(["Student code", "Student name", ...H]);
    expect(rows).toHaveLength(3);
    expect(rows[1][3]).toBe("ABS");
    expect(rows[1][2]).toBe(fullEntry(2, 2)[k(0, 0)]);
  });
});

describe("score sheet import", () => {
  const sheet = (rows: string[][]) => toCsv([["Student code", "Student name", ...H], ...rows]);

  it("applies clean rows and reports the rest with row numbers", () => {
    const text = sheet([
      ["S-001", "Ada", "5", "6", "7", "8"],
      ["S-002", "Bayo", "5", "11", "7", "8"], // over max
      ["S-404", "Nobody", "1", "1", "1", "1"], // unknown student
    ]);
    const out = parseScoreSheet(text, fields, students);
    expect(out.rowsApplied).toBe(1);
    expect(out.rowsSkipped).toBe(2);
    expect(out.applied.u1[k(0, 0)]).toBe("5");
    expect(out.applied.u2).toBeUndefined();
    expect(out.errors.map((e) => `${e.row}:${e.studentCode}`)).toEqual(["3:S-002", "4:S-404"]);
    expect(out.errors[0].message).toMatch(/between 0 and 10/);
  });
  it("turns ABS / EXM / N/A into explicit states", () => {
    const out = parseScoreSheet(sheet([["S-001", "", "ABS", "EXM", "N/A", "3"]]), fields, students);
    expect(out.applied.u1[`${k(0, 0)}#state`]).toBe("absent");
    expect(out.applied.u1[`${k(0, 1)}#state`]).toBe("exempted");
    expect(out.applied.u1[`${k(1, 0)}#state`]).toBe("not_applicable");
    expect(out.applied.u1[k(1, 1)]).toBe("3");
    expect(out.applied.u1[`${k(1, 1)}#state`]).toBe("");
  });
  it("leaves blank cells alone", () => {
    const out = parseScoreSheet(sheet([["S-001", "", "", "6", "", ""]]), fields, students);
    expect(Object.keys(out.applied.u1)).toEqual([k(0, 1), `${k(0, 1)}#state`]);
  });
  it("matches student codes case-insensitively and flags duplicates", () => {
    const out = parseScoreSheet(sheet([["s-001", "", "1", "", "", ""], ["S-001", "", "2", "", "", ""]]), fields, students);
    expect(out.rowsApplied).toBe(1);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0].message).toMatch(/more than once/);
  });
  it("lists unknown columns without failing", () => {
    const text = toCsv([["Student code", "Mystery", ...H], ["S-001", "x", "1", "", "", ""]]);
    const out = parseScoreSheet(text, fields, students);
    expect(out.unknownColumns).toEqual(["Mystery"]);
    expect(out.rowsApplied).toBe(1);
  });
  it("refuses a file with no student code column, and an empty one", () => {
    expect(parseScoreSheet("a,b\n1,2", fields, students).errors[0].message).toMatch(/Student code/);
    expect(parseScoreSheet("", fields, students).errors[0].message).toMatch(/empty/);
  });
  it("produces a downloadable error report", () => {
    const out = parseScoreSheet(sheet([["S-404", "", "1", "1", "1", "1"]]), fields, students);
    expect(parseCsv(buildErrorReport(out.errors))[0]).toEqual(["Row", "Student code", "Column", "Problem"]);
  });
});
