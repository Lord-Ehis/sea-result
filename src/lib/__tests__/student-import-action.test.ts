import { beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => ({ schoolId: "s1", campusIds: null as string[] | null }));
const db = vi.hoisted(() => ({
  campus: { findMany: vi.fn() },
  class: { findMany: vi.fn(), create: vi.fn() },
  student: { findMany: vi.fn(), createMany: vi.fn() },
  school: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/admin-access", () => ({ getAdminAccess: async () => access, requireFullAdmin: async () => access }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/storage", () => ({ StorageNotConfigured: class extends Error {}, putPublicImage: vi.fn() }));

import { importStudents } from "@/app/admin/students/actions";

const HEAD = "Student code,First name,Last name,Class";

beforeEach(() => {
  vi.clearAllMocks();
  access.campusIds = null;
  db.campus.findMany.mockResolvedValue([{ id: "c1", name: "Main" }]);
  db.class.findMany.mockResolvedValue([{ id: "k1", name: "JSS 1A", campusId: "c1" }]);
  db.student.findMany.mockResolvedValue([]);
  db.class.create.mockResolvedValue({ id: "k-new" });
  db.school.findUniqueOrThrow.mockResolvedValue({ studentCodeAuto: false });
  db.school.update.mockResolvedValue({});
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
});

describe("importStudents", () => {
  it("only offers the admin's own campuses and classes", async () => {
    access.campusIds = ["c1"];
    await importStudents(`${HEAD}\nA1,Ada,Obi,JSS 1A`);
    expect(db.campus.findMany.mock.calls[0][0].where).toMatchObject({ schoolId: "s1", AND: [{ id: { in: ["c1"] } }] });
    expect(db.class.findMany.mock.calls[0][0].where).toMatchObject({ schoolId: "s1", campusId: { in: ["c1"] } });
  });

  it("adds every student under the admin's school, creating a missing class once", async () => {
    const r = await importStudents(`${HEAD}\nA1,Ada,Obi,JSS 1A\nA2,Bola,Eze,SS 1\nA3,Chi,Eze,ss 1`);
    expect(r).toMatchObject({ ok: true, created: 3, classesCreated: 1 });
    expect(db.class.create).toHaveBeenCalledTimes(1);
    const data = db.student.createMany.mock.calls[0][0].data;
    expect(data.map((d: { classId: string }) => d.classId)).toEqual(["k1", "k-new", "k-new"]);
    expect(data.every((d: { schoolId: string }) => d.schoolId === "s1")).toBe(true);
  });

  it("imports nothing when any row is bad, and says why", async () => {
    db.student.findMany.mockResolvedValue([{ studentCode: "A2" }]);
    const r = await importStudents(`${HEAD}\nA1,Ada,Obi,\nA2,Bola,Eze,`);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/row 3.*already exists.*Nothing was imported/) });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("explains a race on a student code instead of crashing", async () => {
    db.$transaction.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    const r = await importStudents(`${HEAD}\nA1,Ada,Obi,`);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/just added/) });
  });

  it("refuses an empty, oversized or campus-less request", async () => {
    expect(await importStudents("")).toMatchObject({ ok: false });
    expect(await importStudents("x".repeat(2 * 1024 * 1024 + 1))).toMatchObject({ ok: false, error: expect.stringMatching(/too large/) });
    db.campus.findMany.mockResolvedValue([]);
    expect(await importStudents(`${HEAD}\nA1,Ada,Obi,`)).toMatchObject({ ok: false, error: expect.stringMatching(/no campus/) });
  });
});

describe("importStudents with automatic student codes", () => {
  const settingsRow = { studentCodeAuto: true, studentCodePrefix: "GDA", studentCodeYear: "NONE", studentCodeSeparator: "-", studentCodeDigits: 4, studentCodeNext: 5 };
  beforeEach(() => {
    db.school.findUniqueOrThrow.mockResolvedValue({ studentCodeAuto: true });
    db.$queryRaw.mockResolvedValue([settingsRow]);
  });

  it("creates a code for each blank row, keeps typed ones, and lists every student with their code", async () => {
    const r = await importStudents("First name,Last name,Student code,Class\nAda,Obi,,JSS 1A\nBola,Eze,OWN-77,SS 1\nChi,Eze,,SS 1");
    expect(r).toMatchObject({ ok: true, created: 3 });
    if (!r.ok) throw new Error("expected success");
    expect(r.students.map((x) => [x.studentCode, x.generated])).toEqual([["GDA-0005", true], ["OWN-77", false], ["GDA-0006", true]]);
    expect(r.students[0]).toMatchObject({ firstName: "Ada", className: "JSS 1A" });
    const saved = db.student.createMany.mock.calls[0][0].data.map((d: { studentCode: string }) => d.studentCode);
    expect(saved).toEqual(["GDA-0005", "OWN-77", "GDA-0006"]);
    // The counter moves past what was handed out.
    expect(db.school.update.mock.calls[0][0].data).toEqual({ studentCodeNext: 7 });
  });

  it("does not hand out a code that a typed code in the same file already uses", async () => {
    const r = await importStudents("First name,Last name,Student code\nAda,Obi,GDA-0005\nBola,Eze,");
    if (!r.ok) throw new Error(r.error);
    expect(r.students.map((x) => x.studentCode)).toEqual(["GDA-0005", "GDA-0006"]);
  });

  it("still refuses a blank code when automatic codes are off", async () => {
    db.school.findUniqueOrThrow.mockResolvedValue({ studentCodeAuto: false });
    const r = await importStudents("First name,Last name,Student code\nAda,Obi,");
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/Student code is blank/) });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
