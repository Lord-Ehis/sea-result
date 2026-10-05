import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  passwordResetToken: { updateMany: vi.fn() },
  accountEvent: { create: vi.fn() },
  notification: { findUnique: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
}));
const send = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/notifications", () => ({ createAndSendNotification: send }));
vi.mock("@/lib/password-reset", () => ({ createPasswordResetToken: vi.fn(async () => "raw-token") }));

import { changeUserEmail, maskEmail } from "../change-email";
import { UserError } from "../user-error";

const actor = { userId: "admin-1", role: "SCHOOL_ADMIN" as const, label: "your school administrator" };
const teacher = { id: "t1", schoolId: "s1", name: "Ada Obi", email: "ada@old.example" };

beforeEach(() => {
  vi.clearAllMocks();
  db.user.findUnique.mockResolvedValue(teacher);
  db.user.findFirst.mockResolvedValue(null);
  send.mockResolvedValue("n1");
  db.notification.findUnique.mockResolvedValue({ status: "SENT" });
});

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("jane.doe@example.com")).toBe("j***@example.com");
  });
  it("hides anything that is not an address", () => {
    expect(maskEmail("not-an-email")).toBe("***");
    expect(maskEmail("@example.com")).toBe("***");
  });
});

describe("changeUserEmail", () => {
  it("swaps the email, voids old reset links, records who did it, and emails both addresses", async () => {
    const result = await changeUserEmail({ targetUserId: "t1", newEmail: " ada@new.example ", actor });

    expect(result).toEqual({ newEmail: "ada@new.example", linkSent: true });
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { email: "ada@new.example" } });
    expect(db.passwordResetToken.updateMany).toHaveBeenCalledWith({ where: { userId: "t1", usedAt: null }, data: { usedAt: expect.any(Date) } });
    expect(db.accountEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolId: "s1",
        userId: "t1",
        action: "EMAIL_CHANGED",
        actorUserId: "admin-1",
        actorRole: "SCHOOL_ADMIN",
        metadata: { from: "ada@old.example", to: "ada@new.example" },
      }),
    });

    const [toNew, toOld] = send.mock.calls.map((c) => c[0]);
    expect(toNew.recipient).toBe("ada@new.example");
    expect(toNew.message).toContain("/reset-password?token=raw-token");
    expect(toOld.recipient).toBe("ada@old.example");
    expect(toOld.message).toContain("a***@new.example");
    expect(toOld.message).not.toContain("ada@new.example");
    expect(toOld.message).not.toContain("reset-password");
  });

  it("reports when the password-link email could not be sent", async () => {
    db.notification.findUnique.mockResolvedValue({ status: "FAILED" });
    const result = await changeUserEmail({ targetUserId: "t1", newEmail: "ada@new.example", actor });
    expect(result.linkSent).toBe(false);
  });

  it("refuses an address another account already uses, without changing anything", async () => {
    db.user.findFirst.mockResolvedValue({ id: "other" });
    await expect(changeUserEmail({ targetUserId: "t1", newEmail: "taken@example.com", actor })).rejects.toBeInstanceOf(UserError);
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.accountEvent.create).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses the same address and malformed addresses", async () => {
    await expect(changeUserEmail({ targetUserId: "t1", newEmail: "ADA@old.example", actor })).rejects.toThrow("already");
    await expect(changeUserEmail({ targetUserId: "t1", newEmail: "nope", actor })).rejects.toBeInstanceOf(UserError);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("refuses an account that does not exist or belongs to no school", async () => {
    db.user.findUnique.mockResolvedValue({ ...teacher, schoolId: null });
    await expect(changeUserEmail({ targetUserId: "t1", newEmail: "ada@new.example", actor })).rejects.toBeInstanceOf(UserError);
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
