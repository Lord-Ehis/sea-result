import { beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => ({ schoolId: "s1", campusIds: null as string[] | null }));
const db = vi.hoisted(() => ({
  school: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  campus: { findFirst: vi.fn() },
  class: { findFirst: vi.fn(), create: vi.fn() },
  student: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/admin-access", () => ({ getAdminAccess: async () => access, requireFullAdmin: async () => access }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/storage", () => ({ StorageNotConfigured: class extends Error {}, putPublicImage: vi.fn() }));

import { createStudent } from "@/app/admin/students/actions";

const form = (over: Record<string, string> = {}) => {
  const f = new FormData();
  const base: Record<string, string> = { firstName: "Ada", lastName: "Obi", studentCode: "", campusId: "c1", ...over };
  for (const [k, v] of Object.entries(base)) f.set(k, v);
  return f;
};
const settingsRow = { studentCodeAuto: true, studentCodePrefix: "GDA", studentCodeYear: "NONE", studentCodeSeparator: "-", studentCodeDigits: 4, studentCodeNext: 12 };

beforeEach(() => {
  vi.clearAllMocks();
  access.campusIds = null;
  db.school.findUniqueOrThrow.mockResolvedValue({ studentCodeAuto: true });
  db.school.update.mockResolvedValue({});
  db.campus.findFirst.mockResolvedValue({ id: "c1" });
  db.class.findFirst.mockResolvedValue({ id: "k1" });
  db.class.create.mockResolvedValue({ id: "k-new" });
  db.student.findUnique.mockResolvedValue(null);
  db.student.findMany.mockResolvedValue([]);
  db.student.create.mockResolvedValue({});
  db.$queryRaw.mockResolvedValue([settingsRow]);
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
});

describe("createStudent", () => {
  it("creates the next code when the code is left blank and automatic codes are on", async () => {
    const r = await createStudent(form());
    expect(r).toEqual({ ok: true, studentCode: "GDA-0012", generated: true });
    expect(db.student.create.mock.calls[0][0].data).toMatchObject({ schoolId: "s1", studentCode: "GDA-0012", firstName: "Ada" });
    expect(db.school.update.mock.calls[0][0].data).toEqual({ studentCodeNext: 13 });
  });

  it("uses a typed code exactly as typed, and does not touch the counter", async () => {
    const r = await createStudent(form({ studentCode: "ADM/2026/44" }));
    expect(r).toEqual({ ok: true, studentCode: "ADM/2026/44", generated: false });
    expect(db.school.update).not.toHaveBeenCalled();
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("asks for a code when automatic codes are off", async () => {
    db.school.findUniqueOrThrow.mockResolvedValue({ studentCodeAuto: false });
    expect(await createStudent(form())).toEqual({ ok: false, error: "Student ID/code is required" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a typed code that already exists, with a message that survives production", async () => {
    db.student.findUnique.mockResolvedValue({ id: "x" });
    expect(await createStudent(form({ studentCode: "TAKEN" }))).toEqual({ ok: false, error: "A student with this ID/code already exists." });
    expect(db.class.create).not.toHaveBeenCalled();
    expect(db.student.create).not.toHaveBeenCalled();
  });

  it("makes the new class and the student in one transaction, so a refusal leaves no stray class", async () => {
    await createStudent(form({ newClassName: "SS 3" }));
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.class.create).toHaveBeenCalled();
    expect(db.student.create.mock.calls[0][0].data.classId).toBe("k-new");
  });

  it("refuses a campus or class outside the admin's own", async () => {
    access.campusIds = ["c1"];
    db.campus.findFirst.mockResolvedValue(null);
    expect(await createStudent(form())).toEqual({ ok: false, error: "Campus not found." });
    db.campus.findFirst.mockResolvedValue({ id: "c1" });
    db.class.findFirst.mockResolvedValue(null);
    expect(await createStudent(form({ classId: "other" }))).toEqual({ ok: false, error: "Class not found." });
  });

  it("explains a missing name or a bad email in words, not as a crash", async () => {
    expect(await createStudent(form({ firstName: "" }))).toEqual({ ok: false, error: "First name is required" });
    expect(await createStudent(form({ guardianEmail: "not-an-email" }))).toMatchObject({ ok: false, error: expect.stringMatching(/valid email/) });
  });

  it("explains a code taken by someone else a moment ago", async () => {
    db.$transaction.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    expect(await createStudent(form())).toEqual({ ok: false, error: "A student with this ID/code already exists." });
  });
});
