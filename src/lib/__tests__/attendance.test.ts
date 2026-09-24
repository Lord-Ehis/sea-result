import { describe, expect, it } from "vitest";
import { attendanceSummary } from "@/lib/attendance";
import { compileVersionToFields, ATTENDANCE_OPENED_ID, ATTENDANCE_PRESENT_ID } from "@/lib/version-compile";
import { validateStudentEntry } from "@/lib/result-validate";
import { buildSnapshotPayload } from "@/lib/snapshot";

const input = { legacyGridFieldId: null, legacyFields: [], sections: [], ratingCategories: [], resolvedGradingScale: null };
const fields = compileVersionToFields({ ...input, includeAttendance: true });
const entry = (opened: string, present: string) => ({ [ATTENDANCE_OPENED_ID]: opened, [ATTENDANCE_PRESENT_ID]: present });

describe("attendance", () => {
  it("is compiled only when the version switch is on, with stable ids", () => {
    expect(compileVersionToFields(input)).toHaveLength(0);
    expect(fields.map((f) => f.id)).toEqual([ATTENDANCE_OPENED_ID, ATTENDANCE_PRESENT_ID]);
  });
  it("works out absent and the percentage", () => {
    expect(attendanceSummary(fields, entry("150", "135"))).toEqual({ opened: 150, present: 135, absent: 15, percentage: "90.0" });
  });
  it("shows nothing when a number is missing or present exceeds opened", () => {
    expect(attendanceSummary(fields, entry("150", ""))).toBeNull();
    expect(attendanceSummary(fields, entry("100", "101"))).toBeNull();
    expect(attendanceSummary([], entry("150", "135"))).toBeNull();
  });
  it("accepts whole days only and blocks present > opened", () => {
    expect(validateStudentEntry(fields, entry("150", "135")).errors).toEqual([]);
    expect(validateStudentEntry(fields, entry("150", "-1")).errors).toHaveLength(1);
    expect(validateStudentEntry(fields, entry("150", "12.5")).errors).toHaveLength(1);
    const over = validateStudentEntry(fields, entry("100", "101")).errors;
    expect(over.map((e) => e.key)).toEqual([ATTENDANCE_PRESENT_ID]);
  });
  it("is carried as its own block, not repeated in the flat fields", () => {
    const payload = buildSnapshotPayload({
      school: { name: "S", slug: "s" },
      student: { name: "A", code: "1", className: "C", campusName: "M" },
      period: { session: "2025", term: "1st Term" },
      template: { id: "t", name: "T", versionId: null, fields },
      data: entry("150", "135"),
      publication: { version: 1, verificationCode: "X", publishedAt: new Date() },
    });
    expect(payload.attendance?.absent).toBe(15);
    expect(payload.fields).toEqual([]);
  });
});
