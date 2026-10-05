import { describe, expect, it } from "vitest";
import { buildSignOff, buildSnapshotPayload, isSnapshotIntact, snapshotChecksum } from "@/lib/snapshot";

const base = {
  student: { name: "A B", code: "1", className: "C", campusName: "M" },
  period: { session: "2025/2026", term: "1st Term" },
  template: { id: "t", name: "T", versionId: null, fields: [] },
  data: {},
  publication: { version: 1, verificationCode: "X", publishedAt: new Date("2026-01-01T00:00:00Z") },
};

describe("sign-off", () => {
  it("is null when there is nothing to show", () => {
    expect(buildSignOff({ school: {}, teacherName: null })).toBeNull();
  });
  it("carries teacher, principal, stamp and a next-term ISO date", () => {
    const out = buildSignOff({
      school: { principalName: "Mr P", stampUrl: "https://x/s.png", nextTermBegins: new Date("2027-01-07T00:00:00Z") },
      teacherName: "Ms T",
    });
    expect(out).toMatchObject({ teacherName: "Ms T", principalName: "Mr P", nextTermBegins: "2027-01-07T00:00:00.000Z" });
  });
  it("keeps the wider school row (sign-off columns, dates) out of payload.school and the checksum intact", () => {
    const school = { name: "S", slug: "s", principalName: "Mr P", nextTermBegins: new Date("2027-01-07T00:00:00Z") };
    const payload = buildSnapshotPayload({ ...base, school, signOff: buildSignOff({ school, teacherName: "Ms T" }) });
    expect(Object.keys(payload.school)).not.toContain("principalName");
    expect(Object.keys(payload.school)).not.toContain("nextTermBegins");
    const stored = JSON.parse(JSON.stringify(payload));
    expect(isSnapshotIntact({ payload: stored, checksum: snapshotChecksum(payload) })).toBe(true);
  });
});
