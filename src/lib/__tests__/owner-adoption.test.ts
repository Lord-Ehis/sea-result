import { describe, expect, it } from "vitest";
import { agoText, classifyAdoption, isHealth, parentCoverage, sortForAttention, type AdoptionInput, type Health } from "@/lib/owner-adoption";

const d = (iso: string) => new Date(iso);
const now = d("2026-10-07T12:00:00Z");
const base: AdoptionInput = { status: "ACTIVE", createdAt: d("2026-06-01T00:00:00Z"), students: 40, teachers: 4, templates: 2, lastActivityAt: d("2026-10-01T00:00:00Z") };
const classify = (over: Partial<AdoptionInput>) => classifyAdoption({ ...base, ...over }, now);

describe("classifyAdoption", () => {
  it("rates a school with recent result activity as active", () => {
    expect(classify({})).toEqual({ health: "ACTIVE", reason: "Results last worked on 6 days ago" });
  });

  it("draws the active/quiet/dormant lines at 30 and 90 days", () => {
    expect(classify({ lastActivityAt: d("2026-09-07T12:00:00Z") }).health).toBe("ACTIVE"); // exactly 30
    expect(classify({ lastActivityAt: d("2026-09-06T12:00:00Z") }).health).toBe("QUIET"); // 31
    expect(classify({ lastActivityAt: d("2026-07-09T12:00:00Z") }).health).toBe("QUIET"); // exactly 90
    expect(classify({ lastActivityAt: d("2026-07-08T12:00:00Z") }).health).toBe("DORMANT"); // 91
  });

  it("calls a set-up school that never entered results dormant", () => {
    expect(classify({ lastActivityAt: null })).toEqual({ health: "DORMANT", reason: "Set up, but no results have ever been entered" });
  });

  it("gives a brand-new school two weeks before judging it", () => {
    expect(classify({ createdAt: d("2026-10-05T00:00:00Z"), students: 0, teachers: 0, templates: 0, lastActivityAt: null }).health).toBe("NEW");
    expect(classify({ createdAt: d("2026-09-24T00:00:00Z"), students: 0, lastActivityAt: null }).health).toBe("NEW"); // 13 days
    expect(classify({ createdAt: d("2026-09-23T00:00:00Z"), students: 0, lastActivityAt: null }).health).toBe("SETTING_UP"); // 14 days
  });

  it("says exactly what a school still lacks", () => {
    expect(classify({ students: 0, templates: 0 })).toEqual({ health: "SETTING_UP", reason: "Still has no students, no result template" });
    expect(classify({ students: 0, teachers: 0, templates: 0 }).reason).toBe("Still has no students, no teachers, no result template");
  });

  it("does not rate switched-off schools or ones waiting on deletion", () => {
    expect(classify({ status: "SUSPENDED" })).toEqual({ health: "NOT_RATED", reason: "Switched off" });
    expect(classify({ status: "PENDING_DELETION" }).health).toBe("NOT_RATED");
  });
});

describe("agoText", () => {
  it("reads naturally", () => {
    expect(agoText(0)).toBe("today");
    expect(agoText(1)).toBe("yesterday");
    expect(agoText(12)).toBe("12 days ago");
  });
});

describe("parentCoverage", () => {
  it("is the share of students with a parent linked", () => {
    expect(parentCoverage(30, 40)).toBe(75);
    expect(parentCoverage(1, 3)).toBe(33);
    expect(parentCoverage(40, 40)).toBe(100);
  });
  it("is not defined without students, and never passes 100", () => {
    expect(parentCoverage(0, 0)).toBeNull();
    expect(parentCoverage(5, 4)).toBe(100);
  });
});

describe("sortForAttention", () => {
  const row = (name: string, health: Health, last: string | null) => ({ name, health, lastActivityAt: last ? d(last) : null });
  const ranked = sortForAttention([
    row("Active A", "ACTIVE", "2026-10-06T00:00:00Z"),
    row("Quiet B", "QUIET", "2026-08-20T00:00:00Z"),
    row("Dormant new-ish", "DORMANT", "2026-06-01T00:00:00Z"),
    row("Dormant never", "DORMANT", null),
    row("Setting up", "SETTING_UP", null),
    row("Quiet A", "QUIET", "2026-08-01T00:00:00Z"),
    row("Off", "NOT_RATED", null),
    row("Fresh", "NEW", null),
  ]).map((r) => r.name);

  it("puts dormant first, then quiet, setting up, new, active, and unrated last", () => {
    expect(ranked).toEqual(["Dormant never", "Dormant new-ish", "Quiet A", "Quiet B", "Setting up", "Fresh", "Active A", "Off"]);
  });
  it("does not change the list it was given", () => {
    const input = [row("B", "ACTIVE", null), row("A", "ACTIVE", null)];
    sortForAttention(input);
    expect(input.map((r) => r.name)).toEqual(["B", "A"]);
  });
});

describe("isHealth", () => {
  it("accepts only the known ratings", () => {
    expect(isHealth("QUIET")).toBe(true);
    expect(isHealth("nonsense")).toBe(false);
    expect(isHealth(undefined)).toBe(false);
  });
});
