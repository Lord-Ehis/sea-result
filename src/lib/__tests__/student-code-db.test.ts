import { beforeEach, describe, expect, it, vi } from "vitest";
import { reserveStudentCodes, readStudentCodeSettings } from "@/lib/student-code-db";

const tx = {
  $queryRaw: vi.fn(),
  student: { findMany: vi.fn() },
  school: { update: vi.fn(), findUniqueOrThrow: vi.fn() },
};
const row = { studentCodeAuto: true, studentCodePrefix: "GDA", studentCodeYear: "YYYY", studentCodeSeparator: "-", studentCodeDigits: 4, studentCodeNext: 1 };
const now = new Date("2026-10-11T10:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  tx.$queryRaw.mockResolvedValue([row]);
  tx.student.findMany.mockResolvedValue([]);
  tx.school.update.mockResolvedValue({});
});

describe("reserveStudentCodes", () => {
  it("locks the school's row while it chooses, so two requests at once cannot get the same code", async () => {
    await reserveStudentCodes(tx as never, "s1", 1, [], now);
    const sql = (tx.$queryRaw.mock.calls[0][0] as string[]).join("?");
    expect(sql).toMatch(/FROM schools WHERE id = \?\s+FOR UPDATE/);
  });

  it("returns consecutive codes and moves the counter on", async () => {
    const codes = await reserveStudentCodes(tx as never, "s1", 3, [], now);
    expect(codes).toEqual(["GDA-2026-0001", "GDA-2026-0002", "GDA-2026-0003"]);
    expect(tx.school.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { studentCodeNext: 4 } });
  });

  it("skips codes already used by students, typed or generated, and codes typed in the same batch", async () => {
    tx.student.findMany.mockResolvedValue([{ studentCode: "gda-2026-0001" }]);
    const codes = await reserveStudentCodes(tx as never, "s1", 2, ["GDA-2026-0002"], now);
    expect(codes).toEqual(["GDA-2026-0003", "GDA-2026-0004"]);
  });

  it("only looks at codes that start the way new ones do", async () => {
    await reserveStudentCodes(tx as never, "s1", 1, [], now);
    expect(tx.student.findMany.mock.calls[0][0].where).toEqual({ schoolId: "s1", studentCode: { startsWith: "GDA-2026-", mode: "insensitive" } });
  });

  it("refuses when automatic codes are off, or the school is missing", async () => {
    tx.$queryRaw.mockResolvedValue([{ ...row, studentCodeAuto: false }]);
    await expect(reserveStudentCodes(tx as never, "s1", 1, [], now)).rejects.toThrow(/not switched on/);
    tx.$queryRaw.mockResolvedValue([]);
    await expect(reserveStudentCodes(tx as never, "s1", 1, [], now)).rejects.toThrow(/School not found/);
    expect(tx.school.update).not.toHaveBeenCalled();
  });
});

describe("readStudentCodeSettings", () => {
  it("maps the school's columns to the settings", async () => {
    tx.school.findUniqueOrThrow.mockResolvedValue({ ...row, studentCodeNext: 1201, studentCodeYear: "YY" });
    expect(await readStudentCodeSettings(tx as never, "s1")).toEqual({ auto: true, prefix: "GDA", year: "YY", separator: "-", digits: 4, next: 1201 });
  });
});
