import { describe, expect, it } from "vitest";
import { batchWhere, campusWhere, canAccessCampus, classWhere, isScoped, ofStudentWhere, studentWhere } from "@/lib/campus-scope";

const everyone = { campusIds: null };
const campusB = { campusIds: ["campus-b"] };
const nobody = { campusIds: [] as string[] };

describe("campus access (RT-13)", () => {
  it("an unrestricted admin can reach every campus", () => {
    expect(isScoped(everyone)).toBe(false);
    expect(canAccessCampus(everyone, "campus-a")).toBe(true);
    expect(canAccessCampus(everyone, "campus-b")).toBe(true);
  });

  it("a campus admin reaches only their own campuses", () => {
    expect(isScoped(campusB)).toBe(true);
    expect(canAccessCampus(campusB, "campus-b")).toBe(true);
    expect(canAccessCampus(campusB, "campus-a")).toBe(false);
  });

  it("a campus admin with no campuses reaches nothing — never everything", () => {
    expect(isScoped(nobody)).toBe(true);
    expect(canAccessCampus(nobody, "campus-a")).toBe(false);
    expect(classWhere(nobody)).toEqual({ campusId: { in: [] } });
  });

  it("no campus on the record is out of scope for a campus admin", () => {
    expect(canAccessCampus(campusB, null)).toBe(false);
    expect(canAccessCampus(campusB, undefined)).toBe(false);
    expect(canAccessCampus(campusB, "")).toBe(false);
  });

  it("adds no filter at all for an unrestricted admin, so it can always be spread into a query", () => {
    expect(classWhere(everyone)).toEqual({});
    expect(studentWhere(everyone)).toEqual({});
    expect(campusWhere(everyone)).toEqual({});
    expect(batchWhere(everyone)).toEqual({});
    expect(ofStudentWhere(everyone)).toEqual({});
  });

  it("builds the filters a campus admin's queries need", () => {
    expect(classWhere(campusB)).toEqual({ campusId: { in: ["campus-b"] } });
    expect(studentWhere(campusB)).toEqual({ campusId: { in: ["campus-b"] } });
    expect(campusWhere(campusB)).toEqual({ AND: [{ id: { in: ["campus-b"] } }] });
    expect(batchWhere(campusB)).toEqual({ class: { campusId: { in: ["campus-b"] } } });
    expect(ofStudentWhere(campusB)).toEqual({ student: { campusId: { in: ["campus-b"] } } });
  });

  it("never replaces a caller's own id filter when spread next to it", () => {
    // The bug this pins: `{ id: "campus-a", ...campusWhere(b) }` once became `{ id: { in: ["campus-b"] } }`.
    const where = { id: "campus-a", schoolId: "s", ...campusWhere(campusB) };
    expect(where.id).toBe("campus-a");
    expect(where).toEqual({ id: "campus-a", schoolId: "s", AND: [{ id: { in: ["campus-b"] } }] });
    expect({ id: "campus-a", ...classWhere(campusB), ...studentWhere(campusB) }.id).toBe("campus-a");
  });

  it("supports several campuses", () => {
    const two = { campusIds: ["a", "b"] };
    expect(canAccessCampus(two, "a")).toBe(true);
    expect(canAccessCampus(two, "b")).toBe(true);
    expect(canAccessCampus(two, "c")).toBe(false);
    expect(classWhere(two)).toEqual({ campusId: { in: ["a", "b"] } });
  });
});
