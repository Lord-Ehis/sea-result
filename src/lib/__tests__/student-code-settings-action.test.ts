import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ school: { update: vi.fn() } }));
const full = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/admin-access", () => ({ requireFullAdmin: full }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/storage", () => ({ StorageNotConfigured: class extends Error {}, putPublicImage: vi.fn() }));

import { saveStudentCodeSettings } from "@/app/admin/school-profile/actions";

const good = { auto: true, prefix: "gda", year: "YYYY", separator: "-", digits: 4, next: 1201 };

beforeEach(() => {
  vi.clearAllMocks();
  full.mockResolvedValue({ schoolId: "s1", userId: "u1" });
  db.school.update.mockResolvedValue({});
});

describe("saveStudentCodeSettings", () => {
  it("saves the tidied settings for the admin's own school and returns what the next code looks like", async () => {
    const r = await saveStudentCodeSettings(good);
    expect(r.ok && /^GDA-\d{4}-1201$/.test(r.example)).toBe(true);
    expect(db.school.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { studentCodeAuto: true, studentCodePrefix: "GDA", studentCodeYear: "YYYY", studentCodeSeparator: "-", studentCodeDigits: 4, studentCodeNext: 1201 },
    });
  });

  it("is for the main school admin only", async () => {
    full.mockRejectedValue(new Error("Only the main school admin can do this."));
    await expect(saveStudentCodeSettings(good)).rejects.toThrow(/main school admin/);
    expect(db.school.update).not.toHaveBeenCalled();
  });

  it("refuses bad settings with the reason, and saves nothing", async () => {
    expect(await saveStudentCodeSettings({ ...good, digits: 9 })).toMatchObject({ ok: false, error: expect.stringMatching(/number length/) });
    expect(await saveStudentCodeSettings({ ...good, prefix: "", year: "NONE" })).toMatchObject({ ok: false, error: expect.stringMatching(/prefix or a year/) });
    expect(db.school.update).not.toHaveBeenCalled();
  });
});

describe("student code wiring", () => {
  const read = (...p: string[]) => readFileSync(join(process.cwd(), "src", ...p), "utf8");

  it("the settings action asks for the main school admin before anything else", () => {
    const actions = read("app", "admin", "school-profile", "actions.ts");
    const body = actions.slice(actions.indexOf("export async function saveStudentCodeSettings"));
    expect(body.slice(0, 200)).toMatch(/await requireFullAdmin\(\)/);
  });

  it("numbers are only handed out inside a transaction that holds the school's row", () => {
    const db = read("lib", "student-code-db.ts");
    expect(db).toMatch(/FOR UPDATE/);
    const actions = read("app", "admin", "students", "actions.ts");
    for (const fn of ["createStudent", "importStudents"]) {
      const body = actions.slice(actions.indexOf(`export async function ${fn}`));
      expect(body.indexOf("prisma.$transaction"), `${fn} must reserve codes in a transaction`).toBeGreaterThan(-1);
      expect(body.indexOf("prisma.$transaction")).toBeLessThan(body.indexOf("reserveStudentCodes("));
    }
  });
});
