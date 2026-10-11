import { describe, expect, it } from "vitest";
import { allocateCodes, cleanPrefix, codeHead, defaultPrefix, exampleCode, formatCode, validateSettings, type StudentCodeSettings } from "@/lib/student-code";

const now = new Date("2026-10-11T10:00:00Z");
const settings = (over: Partial<StudentCodeSettings> = {}): StudentCodeSettings => ({ auto: true, prefix: "GDA", year: "YYYY", separator: "-", digits: 4, next: 1, ...over });

describe("defaultPrefix", () => {
  it("uses the school's initials", () => {
    expect(defaultPrefix("Greenfield Demo Academy")).toBe("GDA");
    expect(defaultPrefix("Graceland International School")).toBe("GIS");
    expect(defaultPrefix("The King's College of Lagos")).toBe("KCL");
  });

  it("falls back to the first letters of a one-word name, then to STU", () => {
    expect(defaultPrefix("Hillcrest")).toBe("HIL");
    expect(defaultPrefix("???")).toBe("STU");
    expect(defaultPrefix("A very long school name with many words in it today")).toHaveLength(8);
  });
});

describe("cleanPrefix", () => {
  it("keeps capital letters and digits only, at most eight", () => {
    expect(cleanPrefix(" gda-1/ ")).toBe("GDA1");
    expect(cleanPrefix("abcdefghijkl")).toBe("ABCDEFGH");
  });
});

describe("formatCode", () => {
  it("builds prefix, year and a padded number", () => {
    expect(formatCode(settings(), 1, now)).toBe("GDA-2026-0001");
    expect(formatCode(settings({ year: "YY" }), 42, now)).toBe("GDA-26-0042");
    expect(formatCode(settings({ year: "NONE", separator: "/" }), 7, now)).toBe("GDA/0007");
    expect(formatCode(settings({ separator: "" }), 12, now)).toBe("GDA20260012");
    expect(formatCode(settings({ prefix: "", year: "NONE" }), 5, now)).toBe("0005");
  });

  it("widens rather than cuts a number longer than its length", () => {
    expect(formatCode(settings({ digits: 3 }), 12345, now)).toBe("GDA-2026-12345");
  });

  it("describes the part before the number, for finding clashes", () => {
    expect(codeHead(settings(), now)).toBe("GDA-2026-");
    expect(codeHead(settings({ prefix: "", year: "NONE" }), now)).toBe("");
  });
});

describe("allocateCodes", () => {
  it("hands out consecutive codes and says where to continue", () => {
    const r = allocateCodes(3, settings({ next: 10 }), new Set(), now);
    expect(r.codes).toEqual(["GDA-2026-0010", "GDA-2026-0011", "GDA-2026-0012"]);
    expect(r.next).toBe(13);
  });

  it("skips a code already taken, ignoring case", () => {
    const r = allocateCodes(2, settings(), new Set(["gda-2026-0002"]), now);
    expect(r.codes).toEqual(["GDA-2026-0001", "GDA-2026-0003"]);
    expect(r.next).toBe(4);
  });

  it("never hands out the same code twice in one go", () => {
    const r = allocateCodes(50, settings(), new Set(), now);
    expect(new Set(r.codes.map((c) => c.toLowerCase())).size).toBe(50);
  });
});

describe("validateSettings", () => {
  const ok = { auto: true, prefix: "gda", year: "YYYY", separator: "-", digits: 4, next: 1 };

  it("accepts a good set and tidies the prefix", () => {
    const r = validateSettings(ok);
    expect(r).toEqual({ ok: true, value: { auto: true, prefix: "GDA", year: "YYYY", separator: "-", digits: 4, next: 1 } });
  });

  it("refuses bad choices with a plain reason", () => {
    expect(validateSettings({ ...ok, prefix: "$$$" })).toMatchObject({ ok: false, error: expect.stringMatching(/letters and digits/) });
    expect(validateSettings({ ...ok, year: "2026" })).toMatchObject({ ok: false });
    expect(validateSettings({ ...ok, separator: "." })).toMatchObject({ ok: false });
    expect(validateSettings({ ...ok, digits: 2 })).toMatchObject({ ok: false });
    expect(validateSettings({ ...ok, digits: 7 })).toMatchObject({ ok: false });
    expect(validateSettings({ ...ok, next: 0 })).toMatchObject({ ok: false });
    expect(validateSettings({ ...ok, next: 1.5 })).toMatchObject({ ok: false });
  });

  it("will not turn on a code that is only a number", () => {
    expect(validateSettings({ ...ok, prefix: "", year: "NONE" })).toMatchObject({ ok: false, error: expect.stringMatching(/prefix or a year/) });
    expect(validateSettings({ ...ok, auto: false, prefix: "", year: "NONE" })).toMatchObject({ ok: true });
  });
});

describe("exampleCode", () => {
  it("shows the next code", () => {
    expect(exampleCode(settings({ next: 1201 }), now)).toBe("GDA-2026-1201");
  });
});
