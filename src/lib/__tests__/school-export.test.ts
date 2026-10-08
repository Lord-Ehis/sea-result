import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { buildSchoolExport, slug, zipFiles, type ExportInput } from "@/lib/school-export";

const now = new Date("2026-10-08T10:00:00Z");
const d = (s: string) => new Date(s);

const input = (over: Partial<ExportInput> = {}): ExportInput => ({
  school: { name: "Graceland International School", slug: "graceland", status: "SUSPENDED", address: "1 Road", phone: null, supportEmail: null, principalName: "Mrs Eze", createdAt: d("2026-09-13T00:00:00Z") },
  campuses: [{ id: "c1", name: "Main campus", address: null }],
  classes: [{ id: "k1", name: "JSS 1", level: "JSS 1", session: "2026/2027", campusId: "c1" }],
  students: [
    { id: "s1", studentCode: "GR-001", firstName: "Ada", lastName: "Obi", classId: "k1", campusId: "c1", isActive: true, dateOfBirth: d("2014-09-30T00:00:00Z"), gender: "Female", admissionNumber: null, guardianName: "Mrs Obi", guardianPhone: "+2348012345678", guardianEmail: "obi@example.com" },
    { id: "s2", studentCode: "GR-002", firstName: "=Bola", lastName: "Eze", classId: null, campusId: "c1", isActive: false, dateOfBirth: null, gender: null, admissionNumber: null, guardianName: null, guardianPhone: null, guardianEmail: null },
  ],
  users: [
    { id: "u1", name: "Nneka Eze", email: "admin@graceland.ng", phone: null, role: "SCHOOL_ADMIN", isActive: true, campusScoped: false, createdAt: d("2026-09-13T00:00:00Z"), campusIds: [] },
    { id: "u2", name: "Tunde Bello", email: "tunde@graceland.ng", phone: null, role: "TEACHER", isActive: true, campusScoped: false, createdAt: d("2026-09-14T00:00:00Z"), campusIds: [] },
    { id: "u3", name: "Mrs Obi", email: "obi@example.com", phone: null, role: "PARENT", isActive: true, campusScoped: false, createdAt: d("2026-09-15T00:00:00Z"), campusIds: [] },
  ],
  parentLinks: [{ parentUserId: "u3", studentId: "s1" }],
  teacherAssignments: [{ teacherId: "u2", classId: "k1" }],
  templates: [{ id: "t1", name: "JSS 1 card", term: "Term 1, 2026/2027", fields: [{ id: "f1", name: "English", type: "Number" }] }],
  results: [{ id: "r1", studentId: "s1", templateId: "t1", term: "Term 1, 2026/2027", session: "2026/2027", status: "PUBLISHED", data: { f1: "78" }, submittedAt: null, approvedAt: null, publishedAt: d("2026-10-01T00:00:00Z"), rejectionNote: null }],
  snapshots: [{ resultId: "r1", studentId: "s1", version: 1, verificationCode: "ABCD-1234", publishedAt: d("2026-10-01T00:00:00Z"), supersededAt: null, amendmentReason: null }],
  subscriptions: [],
  payments: [{ paystackReference: "SEA-1", amount: "40000", currency: "NGN", status: "SUCCESS", billingCycle: "PER_TERM", session: "2026/2027", paidAt: d("2026-09-13T00:00:00Z"), createdAt: d("2026-09-13T00:00:00Z") }],
  notifications: [{ channel: "SMS", event: "RESULT_PUBLISHED", recipient: "+2348012345678", status: "SENT", createdAt: d("2026-10-01T00:00:00Z"), studentId: "s1" }],
  resultEvents: [],
  accountEvents: [],
  ...over,
});

describe("buildSchoolExport", () => {
  it("makes a spreadsheet for each part of the school and a README", () => {
    const { files } = buildSchoolExport(input(), now);
    for (const name of ["school.csv", "campuses.csv", "classes.csv", "students.csv", "staff.csv", "parents.csv", "results.csv", "published-results.csv", "subscriptions.csv", "payments.csv", "messages.csv", "history.csv", "raw/results.json", "raw/templates.json", "README.txt"]) {
      expect(files, name).toHaveProperty([name]);
    }
    expect(files["README.txt"]).toContain("Data for Graceland International School");
    expect(files["README.txt"]).toContain("2 students, 2 staff, 1 parents, 1 results, 1 payments");
  });

  it("lists students with their class, campus and guardian, and neutralises formulas", () => {
    const rows = buildSchoolExport(input(), now).files["students.csv"].replace("﻿", "").split("\r\n");
    expect(rows[0]).toBe("Student code,First name,Last name,Class,Campus,Active,Date of birth,Gender,Admission number,Guardian name,Guardian phone,Guardian email");
    expect(rows[1]).toBe("GR-001,Ada,Obi,JSS 1,Main campus,Yes,2014-09-30,Female,,Mrs Obi,+2348012345678,obi@example.com");
    expect(rows[2]).toContain("'=Bola");
  });

  it("splits staff from parents and never includes a password or token", () => {
    const { files } = buildSchoolExport(input(), now);
    expect(files["staff.csv"]).toContain("Nneka Eze");
    expect(files["staff.csv"]).toContain("Tunde Bello");
    expect(files["staff.csv"]).not.toContain("Mrs Obi");
    expect(files["staff.csv"]).toContain("JSS 1"); // the teacher's class
    expect(files["parents.csv"]).toContain("Mrs Obi,obi@example.com");
    expect(files["parents.csv"]).toContain("GR-001");
    expect(Object.values(files).join("\n")).not.toMatch(/passwordHash|totpSecret|\$2[aby]\$/i);
  });

  it("writes one readable score sheet per template, term and session", () => {
    const { files } = buildSchoolExport(input(), now);
    const sheets = Object.keys(files).filter((f) => f.startsWith("scores/"));
    expect(sheets).toHaveLength(1);
    const csv = files[sheets[0]].replace("﻿", "");
    expect(csv.split("\r\n")[0]).toBe("Student code,Student name,English");
    expect(csv.split("\r\n")[1]).toBe("GR-001,Ada Obi,78");
  });

  it("keeps score sheet names unique even when two templates sound alike", () => {
    const base = input();
    const two = input({
      templates: [...base.templates, { id: "t2", name: "JSS 1 card!", term: "Term 1, 2026/2027", fields: base.templates[0].fields }],
      results: [...base.results, { ...base.results[0], id: "r2", templateId: "t2" }],
    });
    const names = Object.keys(buildSchoolExport(two, now).files).filter((f) => f.startsWith("scores/"));
    expect(new Set(names).size).toBe(2);
  });

  it("copes with a school that has nothing in it", () => {
    const empty = input({ campuses: [], classes: [], students: [], users: [], parentLinks: [], teacherAssignments: [], templates: [], results: [], snapshots: [], payments: [], notifications: [] });
    const { files, counts } = buildSchoolExport(empty, now);
    expect(counts.students).toBe(0);
    expect(Object.keys(files).filter((f) => f.startsWith("scores/"))).toHaveLength(0);
    expect(files["students.csv"].replace("﻿", "").split("\r\n")).toHaveLength(1);
  });
});

describe("zipFiles", () => {
  it("produces a real ZIP whose files read back unchanged, folders included", () => {
    const { files } = buildSchoolExport(input(), now);
    const back = unzipSync(zipFiles(files));
    expect(Object.keys(back).sort()).toEqual(Object.keys(files).sort());
    // (reading the bytes back drops the invisible byte-order mark that Excel uses to detect UTF-8)
    expect(strFromU8(back["students.csv"])).toBe(files["students.csv"].replace("﻿", ""));
    expect(strFromU8(back["raw/results.json"])).toBe(files["raw/results.json"]);
  });
});

describe("slug", () => {
  it("makes a safe file name part", () => {
    expect(slug("Bailey's Report Card!")).toBe("Bailey-s-Report-Card");
    expect(slug("../../etc")).toBe("etc");
    expect(slug("   ")).toBe("untitled");
    expect(slug("x".repeat(200))).toHaveLength(50);
  });
});
