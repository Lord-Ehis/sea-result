import { describe, expect, it } from "vitest";
import { ACTION_LABEL, describeEvent, eventStudentId } from "@/lib/audit-describe";

describe("audit event descriptions", () => {
  it("labels every action", () => {
    for (const a of ["SUBMITTED", "SENT_BACK", "APPROVED", "PUBLISHED", "AMENDED", "TERM_EXCEPTION_SET", "TERM_EXCEPTION_CLEARED"]) {
      expect(ACTION_LABEL[a]).toBeTruthy();
    }
  });

  it("summarises an amendment with the old and new values", () => {
    const text = describeEvent("AMENDED", {
      version: 2,
      positionsKept: true,
      changes: [{ label: "Maths · Exam", from: "45", to: "54" }, { label: "English · CA", from: "", to: "9" }],
    });
    expect(text).toBe("Version 2 — Maths · Exam: 45 → 54; English · CA: — → 9 (positions unchanged)");
  });

  it("mentions a promotion change", () => {
    expect(describeEvent("AMENDED", { version: 3, changes: [], promotion: { status: "RETAINED" } })).toContain("promotion decision changed");
  });

  it("describes workflow events", () => {
    expect(describeEvent("SUBMITTED", { students: 1 })).toBe("1 student");
    expect(describeEvent("APPROVED", { students: 32 })).toBe("32 students");
    expect(describeEvent("PUBLISHED", { students: 4, annualSummary: true })).toBe("4 students · with annual summary");
    expect(describeEvent("PUBLISHED", { backfilled: true })).toBe("recorded retrospectively");
    expect(describeEvent("SENT_BACK", null)).toBe("");
  });

  it("describes not-enrolled marks in the 1st/2nd/3rd Term style", () => {
    expect(describeEvent("TERM_EXCEPTION_SET", { termNumber: 1, status: "NOT_ENROLLED", session: "2025/2026" })).toBe("1st Term: not enrolled (2025/2026)");
    expect(describeEvent("TERM_EXCEPTION_SET", { termNumber: 2, status: "EXEMPT", session: "2025/2026" })).toBe("2nd Term: exempt (2025/2026)");
    expect(describeEvent("TERM_EXCEPTION_CLEARED", { termNumber: 1, session: "2025/2026" })).toBe("1st Term mark removed (2025/2026)");
  });

  it("copes with missing or malformed metadata", () => {
    expect(describeEvent("AMENDED", undefined)).toBe("Version —");
    expect(describeEvent("PUBLISHED", "nonsense")).toBe("");
    expect(eventStudentId({ studentId: "s1" })).toBe("s1");
    expect(eventStudentId(null)).toBeNull();
  });
});
