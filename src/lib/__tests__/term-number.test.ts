import { describe, expect, it } from "vitest";
import { termLabel, termNumberFromLabel } from "@/lib/term-number";

describe("term labels", () => {
  it("writes terms as 1st / 2nd / 3rd Term", () => {
    expect([1, 2, 3].map((n) => termLabel(n as 1 | 2 | 3))).toEqual(["1st Term", "2nd Term", "3rd Term"]);
  });

  it.each([
    ["Term 2, 2025/2026", 2],
    ["First Term", 1],
    ["3rd term", 3],
    ["term3", 3],
    ["1st Term", 1],
    ["Second Term 2024", 2],
    ["Mid-term", null],
    ["", null],
    ["Term 4", null],
  ])("reads %j as %j", (label, expected) => {
    expect(termNumberFromLabel(label)).toBe(expected);
  });
});
