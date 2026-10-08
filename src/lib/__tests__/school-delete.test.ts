import { beforeEach, describe, expect, it, vi } from "vitest";

// Two things matter here: the order rows are removed in (children before the
// things they point to, or the database refuses), and the guards in front of
// the action. The database, storage and sign-in are faked.
const calls = vi.hoisted(() => [] as string[]);
const model = (name: string) => ({
  deleteMany: vi.fn(async (args: unknown) => (calls.push(`${name}.deleteMany ${JSON.stringify((args as { where: unknown }).where)}`), { count: 1 })),
  updateMany: vi.fn(async (args: unknown) => (calls.push(`${name}.updateMany ${JSON.stringify((args as { data: unknown }).data)}`), { count: 1 })),
  delete: vi.fn(async () => (calls.push(`${name}.delete`), {})),
  findUnique: vi.fn(),
  count: vi.fn(async () => 3),
  aggregate: vi.fn(async () => ({ _sum: { amount: 40000 } })),
});
const names = ["publishedResultSnapshot", "studentTermException", "resultEvent", "result", "resultBatch", "notification", "parentStudentLink", "teacherClassAssignment", "userCampusAccess", "passwordResetToken", "deletionRequest", "payment", "subscription", "templateAssignment", "ratingItem", "ratingCategory", "assessmentComponent", "templateSection", "resultTemplate", "templateVersion", "gradingScaleBand", "gradingScale", "subjectList", "annualSummarySettings", "accountEvent", "student", "class", "campus", "user", "school"] as const;
const db = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof model>> & { $transaction: ReturnType<typeof vi.fn>; platformEvent: { create: ReturnType<typeof vi.fn> } });

const authMock = vi.hoisted(() => vi.fn());
const reauth = vi.hoisted(() => vi.fn());
const files = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/owner-reauth", () => ({ confirmOwnerIdentity: reauth }));
vi.mock("@/lib/storage", () => ({ deleteSchoolFiles: files }));
vi.mock("@/lib/school-access-lookup", () => ({ forgetSchoolAccess: vi.fn() }));
vi.mock("@/lib/change-email", () => ({ changeUserEmail: vi.fn() }));

import { deleteSchoolData } from "@/app/owner/schools/actions";
import { deleteSchoolRows } from "@/lib/school-data";
import { UserError } from "@/lib/user-error";

const input = { schoolId: "s1", confirmName: "Graceland", password: "pw", code: "" };
const order = (prefix: string) => calls.findIndex((c) => c.startsWith(prefix));

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  for (const n of names) db[n] = model(n);
  db.platformEvent = { create: vi.fn(async () => (calls.push("event.create"), {})) };
  db.$transaction = vi.fn(async (fn: (tx: typeof db) => unknown) => fn(db));
  db.school.findUnique.mockResolvedValue({ id: "s1", name: "Graceland", status: "SUSPENDED" });
  authMock.mockResolvedValue({ user: { id: "owner-1", role: "PLATFORM_OWNER" } });
  reauth.mockResolvedValue(undefined);
  files.mockResolvedValue(4);
});

describe("deleteSchoolRows", () => {
  it("removes children before what they point to, and the school last", async () => {
    await deleteSchoolRows(db as never, "s1");
    const before = (a: string, b: string) => expect(order(a), `${a} before ${b}`).toBeLessThan(order(b));
    before("result.deleteMany", "resultTemplate.deleteMany"); // a result points at its template
    before("result.deleteMany", "resultBatch.deleteMany");
    before("publishedResultSnapshot", "result.deleteMany");
    before("resultTemplate.updateMany", "templateVersion.deleteMany"); // break the template <-> version loop first
    before("templateVersion.deleteMany", "resultTemplate.deleteMany");
    before("templateVersion.deleteMany", "gradingScale.deleteMany");
    before("payment.deleteMany", "subscription.deleteMany");
    before("deletionRequest.deleteMany", "user.deleteMany"); // it points at the person who made it
    before("parentStudentLink", "student.deleteMany");
    before("teacherClassAssignment", "class.deleteMany");
    before("student.deleteMany", "campus.deleteMany");
    before("campus.deleteMany", "user.deleteMany");
    expect(calls[calls.length - 1]).toBe("school.delete");
  });

  it("only ever touches this school's rows", async () => {
    await deleteSchoolRows(db as never, "s1");
    const wheres = calls.filter((c) => c.includes("deleteMany")).map((c) => c.slice(c.indexOf("{")));
    expect(wheres.length).toBeGreaterThan(25);
    for (const w of wheres) expect(w, w).toContain('"s1"');
    expect(calls).toContain('resultTemplate.updateMany {"currentVersionId":null}');
  });
});

describe("deleteSchoolData", () => {
  it("is for the platform owner only, and checks before reading anything", async () => {
    authMock.mockResolvedValue({ user: { id: "a1", role: "SCHOOL_ADMIN" } });
    await expect(deleteSchoolData(input)).rejects.toThrow("Not authorized");
    authMock.mockResolvedValue(null);
    await expect(deleteSchoolData(input)).rejects.toThrow("Not authorized");
    expect(db.school.findUnique).not.toHaveBeenCalled();
  });

  it("refuses a school that is still active", async () => {
    db.school.findUnique.mockResolvedValue({ id: "s1", name: "Graceland", status: "ACTIVE" });
    const r = await deleteSchoolData(input);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/Switch this school off first/) });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("needs the exact name", async () => {
    for (const confirmName of ["", "graceland", "Graceland School", "Graceland extra"]) {
      expect(await deleteSchoolData({ ...input, confirmName })).toMatchObject({ ok: false, error: expect.stringMatching(/doesn't match/) });
    }
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("needs the owner's password and code to check out", async () => {
    reauth.mockRejectedValue(new UserError("That password is not right."));
    expect(await deleteSchoolData(input)).toEqual({ ok: false, error: "That password is not right." });
    expect(reauth).toHaveBeenCalledWith("owner-1", "pw", "");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("deletes, then records who did it and what went, keeping no link to the deleted school", async () => {
    const r = await deleteSchoolData(input);
    expect(r).toEqual({ ok: true, filesRemoved: 4, filesFailed: false });
    const event = db.platformEvent.create.mock.calls[0][0].data;
    expect(event).toMatchObject({ action: "SCHOOL_DATA_DELETED", actorUserId: "owner-1", schoolId: null });
    expect(event.metadata).toMatchObject({ deletedSchoolId: "s1", schoolName: "Graceland", paidTotal: 40000, counts: { students: 3 } });
    expect(order("school.delete")).toBeLessThan(order("event.create"));
    expect(files).toHaveBeenCalledWith("s1");
  });

  it("still succeeds when stored files can't be removed, and says so", async () => {
    files.mockRejectedValue(new Error("storage down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await deleteSchoolData(input)).toEqual({ ok: true, filesRemoved: null, filesFailed: true });
    spy.mockRestore();
  });

  it("stops if the school was switched back on while the owner was typing", async () => {
    db.school.findUnique.mockResolvedValueOnce({ id: "s1", name: "Graceland", status: "SUSPENDED" }).mockResolvedValueOnce({ status: "ACTIVE" });
    expect(await deleteSchoolData(input)).toMatchObject({ ok: false, error: expect.stringMatching(/switched back on/) });
    expect(calls).not.toContain("school.delete");
    expect(files).not.toHaveBeenCalled();
  });
});
