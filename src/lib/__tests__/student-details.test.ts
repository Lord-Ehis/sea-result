import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { updateVersionDraftSchema } from "@/app/admin/result-templates/version-types";
import { buildSnapshotPayload, type SnapshotStudent } from "@/lib/snapshot";
import { STUDENT_DETAILS, cleanHiddenDetails, hideStudentDetails } from "@/lib/student-details";

const student: SnapshotStudent = {
  name: "Ada Obi",
  code: "GDA-2026-0001",
  className: "JSS 1",
  campusName: "Main campus",
  gender: "Female",
  admissionNumber: "ADM/2026/001",
  dateOfBirth: "2014-03-12T00:00:00.000Z",
  age: 12,
  height: "142 cm",
  weight: "38 kg",
  favouriteColour: "Blue",
  clubOrSociety: "Science Club",
  photoUrl: "https://example.com/ada.jpg",
};

describe("cleanHiddenDetails", () => {
  it("keeps only known details, once each, in their usual order", () => {
    expect(cleanHiddenDetails(["weight", "height", "weight", "shoeSize", 7, null])).toEqual(["height", "weight"]);
    expect(cleanHiddenDetails(undefined)).toEqual([]);
    expect(cleanHiddenDetails("weight")).toEqual([]);
  });
});

describe("hideStudentDetails", () => {
  it("shows everything when nothing is hidden", () => {
    expect(hideStudentDetails(student, [])).toBe(student);
    expect(hideStudentDetails(student, null)).toBe(student);
    expect(hideStudentDetails(student, ["unknown"])).toBe(student);
  });

  it("empties exactly the details that are hidden", () => {
    const out = hideStudentDetails(student, ["height", "weight", "favouriteColour"]);
    expect(out).toMatchObject({ height: null, weight: null, favouriteColour: null, gender: "Female", admissionNumber: "ADM/2026/001", clubOrSociety: "Science Club", photoUrl: "https://example.com/ada.jpg" });
  });

  it("can hide each detail on its own", () => {
    const fieldOf: Record<string, keyof SnapshotStudent> = { campus: "campusName", photo: "photoUrl" };
    for (const { key } of STUDENT_DETAILS) {
      const out = hideStudentDetails(student, [key]);
      const field = fieldOf[key] ?? (key as keyof SnapshotStudent);
      expect(out[field] === null || out[field] === "", `${key} should be emptied`).toBe(true);
      const others = STUDENT_DETAILS.filter((d) => d.key !== key).map((d) => fieldOf[d.key] ?? (d.key as keyof SnapshotStudent));
      for (const other of others) expect(out[other], `${String(other)} should stay when only ${key} is hidden`).toEqual(student[other]);
    }
  });

  it("never touches name, student code or class, and does not change the original", () => {
    const everything = STUDENT_DETAILS.map((d) => d.key);
    const out = hideStudentDetails(student, everything);
    expect(out).toMatchObject({ name: "Ada Obi", code: "GDA-2026-0001", className: "JSS 1" });
    expect(student.height).toBe("142 cm");
  });
});

describe("a hidden detail is not in the frozen published result", () => {
  const base = {
    school: { name: "S", slug: "s" },
    period: { session: "2026/2027", term: "1st Term" },
    template: { id: "t", name: "T", versionId: null, fields: [] },
    data: {},
    publication: { version: 1, verificationCode: "X", publishedAt: new Date("2026-01-01T00:00:00Z") },
  };

  it("leaves the value out of the saved payload altogether", () => {
    const payload = buildSnapshotPayload({ ...base, student: hideStudentDetails(student, ["weight", "height"]) });
    const saved = JSON.stringify(payload);
    expect(saved).not.toContain("38 kg");
    expect(saved).not.toContain("142 cm");
    expect(saved).toContain("Science Club");
  });

  it("keeps showing a detail that was never hidden, so older templates look as before", () => {
    const saved = JSON.stringify(buildSnapshotPayload({ ...base, student: hideStudentDetails(student, []) }));
    expect(saved).toContain("38 kg");
    expect(saved).toContain("142 cm");
  });
});

describe("saving a draft", () => {
  const draft = { versionId: "v1", gradingScaleId: null, sections: [], ratingCategories: [], legacyFields: [] };

  it("shows every detail when the choice is left out, as every older template does", () => {
    expect(updateVersionDraftSchema.parse(draft).hiddenStudentDetails).toEqual([]);
  });

  it("keeps the chosen details and drops anything unknown", () => {
    expect(updateVersionDraftSchema.parse({ ...draft, hiddenStudentDetails: ["weight", "nonsense", "height"] }).hiddenStudentDetails).toEqual(["height", "weight"]);
  });
});

describe("where the choice is applied", () => {
  const read = (...p: string[]) => readFileSync(join(process.cwd(), "src", ...p), "utf8");

  it("publishing and the preview as parent both apply the template version's choice", () => {
    const actions = read("app", "admin", "results", "[batchId]", "actions.ts");
    expect(actions.match(/hideStudentDetails\(studentSnapshotFields\(/g)?.length).toBe(2);
    expect(actions.match(/await hiddenDetailsFor\(batch\.templateVersionId\)/g)?.length).toBe(2);
  });

  it("a new draft copies the choice from the version it was made from", () => {
    expect(read("app", "admin", "result-templates", "version-actions.ts")).toMatch(/hiddenStudentDetails: source\?\.hiddenStudentDetails \?\? \[\]/);
  });

  it("a correction reuses the student as first published, so it keeps the same details hidden", () => {
    const published = read("app", "admin", "published", "actions.ts");
    expect(published).toMatch(/student: p\.previous\.student/);
    expect(published).not.toMatch(/studentSnapshotFields/);
  });
});
