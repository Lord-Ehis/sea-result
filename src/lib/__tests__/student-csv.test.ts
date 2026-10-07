import { describe, expect, it } from "vitest";
import { buildStudentTemplate, normaliseDate, parseStudentSheet, type StudentImportContext } from "@/lib/student-csv";

const ctx = (over: Partial<StudentImportContext> = {}): StudentImportContext => ({
  campuses: [{ id: "c1", name: "Main campus" }],
  classes: [{ id: "k1", name: "JSS 1A", campusId: "c1" }],
  existingCodes: new Set(),
  ...over,
});
const HEAD = "Student code,First name,Last name,Campus,Class,Guardian name,Guardian phone,Guardian email,Date of birth,Gender,Admission number";

describe("parseStudentSheet", () => {
  it("reads a good row, matching the class and the only campus", () => {
    const r = parseStudentSheet(`${HEAD}\nGI-001,Ada,Obi,,jss 1a,Mrs Obi,+234 801 234 5678,ada@example.com,30/09/2014,Female,A/01`, ctx());
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      {
        studentCode: "GI-001",
        firstName: "Ada",
        lastName: "Obi",
        campusId: "c1",
        classId: "k1",
        newClassName: null,
        guardianName: "Mrs Obi",
        guardianPhone: "+234 801 234 5678",
        guardianEmail: "ada@example.com",
        dateOfBirth: "2014-09-30",
        gender: "Female",
        admissionNumber: "A/01",
      },
    ]);
  });

  it("needs only code and names, and accepts common alternative headings", () => {
    const r = parseStudentSheet("ID,Surname,First name\nX1,Obi,Ada", ctx());
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ studentCode: "X1", firstName: "Ada", lastName: "Obi", classId: null, newClassName: null });
  });

  it("creates a class that does not exist yet, once, and lists it", () => {
    const r = parseStudentSheet(`${HEAD}\nA1,Ada,Obi,,SS 2 Art,,,,,,\nA2,Bola,Eze,,ss 2  art,,,,,,`, ctx());
    expect(r.errors).toEqual([]);
    expect(r.newClasses).toEqual(["SS 2 Art"]);
    expect(r.rows.map((x) => x.newClassName)).toEqual(["SS 2 Art", "SS 2 Art"]);
  });

  it("flags a missing required column in the header", () => {
    const r = parseStudentSheet("First name,Last name\nAda,Obi", ctx());
    expect(r.rows).toEqual([]);
    expect(r.errors[0].message).toMatch(/Student code/);
  });

  it("reports blank, duplicate and already-used codes by row", () => {
    const r = parseStudentSheet(`${HEAD}\n,Ada,Obi,,,,,,,,\nA2,Bola,Eze,,,,,,,,\na2,Chi,Eze,,,,,,,,\nOLD,Dee,Eze,,,,,,,,`, ctx({ existingCodes: new Set(["old"]) }));
    expect(r.errors.map((e) => [e.row, e.column])).toEqual([
      [2, "Student code"],
      [4, "Student code"],
      [5, "Student code"],
    ]);
    expect(r.errors[1].message).toMatch(/row 3/);
    expect(r.rows).toEqual([]); // any problem means nothing is imported
  });

  it("requires a campus when there are several, and rejects an unknown one", () => {
    const two = ctx({
      campuses: [
        { id: "c1", name: "Main" },
        { id: "c2", name: "GRA" },
      ],
    });
    const r = parseStudentSheet(`${HEAD}\nA1,Ada,Obi,,,,,,,,\nA2,Bola,Eze,Lekki,,,,,,,\nA3,Chi,Eze,gra,,,,,,,`, two);
    expect(r.errors.map((e) => e.row)).toEqual([2, 3]);
    expect(r.errors[0].message).toMatch(/Main, GRA/);
  });

  it("matches a class within its own campus only", () => {
    const two = ctx({
      campuses: [
        { id: "c1", name: "Main" },
        { id: "c2", name: "GRA" },
      ],
    });
    const r = parseStudentSheet(`${HEAD}\nA1,Ada,Obi,GRA,JSS 1A,,,,,,`, two);
    expect(r.rows[0]).toMatchObject({ campusId: "c2", classId: null, newClassName: "JSS 1A" });
    expect(r.newClasses).toEqual(["JSS 1A (GRA)"]);
  });

  it("validates email, phone and date", () => {
    const r = parseStudentSheet(`${HEAD}\nA1,Ada,Obi,,,,abc,not-an-email,31/02/2014,,`, ctx());
    expect(r.errors.map((e) => e.column).sort()).toEqual(["Date of birth", "Guardian email", "Guardian phone"]);
  });

  it("handles quoted commas, semicolon files and a BOM", () => {
    const r = parseStudentSheet(`﻿Student code;First name;Last name\nA1;"Ada, Jr";Obi`, ctx());
    expect(r.rows[0].firstName).toBe("Ada, Jr");
  });

  it("undoes the apostrophe our own exports put before a formula-like cell", () => {
    const r = parseStudentSheet("Student code,First name,Last name\nA1,'=Ada,Obi", ctx());
    expect(r.rows[0].firstName).toBe("=Ada");
  });

  it("ignores unknown columns but tells you", () => {
    const r = parseStudentSheet("Student code,First name,Last name,Hobby\nA1,Ada,Obi,Chess", ctx());
    expect(r.unknownColumns).toEqual(["Hobby"]);
    expect(r.rows).toHaveLength(1);
  });

  it("rejects an empty file and one with too many rows", () => {
    expect(parseStudentSheet("", ctx()).errors[0].message).toMatch(/empty/);
    const big = "Student code,First name,Last name\n" + Array.from({ length: 1001 }, (_, i) => `S${i},A,B`).join("\n");
    expect(parseStudentSheet(big, ctx()).errors[0].message).toMatch(/more than 1000/);
  });
});

describe("normaliseDate", () => {
  it("accepts ISO and day-first dates and rejects impossible or future ones", () => {
    expect(normaliseDate("2014-9-3")).toBe("2014-09-03");
    expect(normaliseDate("03/09/2014")).toBe("2014-09-03");
    expect(normaliseDate("2014-02-30")).toBeNull();
    expect(normaliseDate("2999-01-01")).toBeNull();
    expect(normaliseDate("yesterday")).toBeNull();
  });
});

describe("buildStudentTemplate", () => {
  it("is just the headings, starting with the required ones", () => {
    expect(buildStudentTemplate().replace("﻿", "")).toBe(HEAD);
  });
});
