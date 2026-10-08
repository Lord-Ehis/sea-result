import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  errorEvent: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), count: vi.fn(), deleteMany: vi.fn() },
  user: { findMany: vi.fn() },
}));
const email = vi.hoisted(() => vi.fn());
const limiter = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/email", () => ({ sendEmail: email }));
vi.mock("@/lib/rate-limit", () => ({ hit: limiter }));

import { captureServerError } from "@/lib/error-capture";

const now = new Date("2026-10-08T12:00:00Z");
const ctx = { routePath: "/admin/students", routeType: "render" };

beforeEach(() => {
  vi.clearAllMocks();
  db.errorEvent.findUnique.mockResolvedValue(null);
  db.errorEvent.count.mockResolvedValue(5);
  db.errorEvent.deleteMany.mockResolvedValue({ count: 0 });
  db.errorEvent.upsert.mockResolvedValue({ id: "e1", count: 1 });
  db.errorEvent.updateMany.mockResolvedValue({ count: 1 });
  db.user.findMany.mockResolvedValue([{ email: "owner@example.com" }]);
  limiter.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  email.mockResolvedValue(undefined);
});

describe("captureServerError", () => {
  it("records a new error and emails every active platform owner", async () => {
    await captureServerError(new Error("boom"), ctx, now);
    const upsert = db.errorEvent.upsert.mock.calls[0][0];
    expect(upsert.create).toMatchObject({ name: "Error", message: "boom", route: "/admin/students", routeType: "render" });
    expect(upsert.update.count).toEqual({ increment: 1 });
    expect(db.user.findMany.mock.calls[0][0].where).toEqual({ role: "PLATFORM_OWNER", isActive: true });
    expect(email).toHaveBeenCalledWith(expect.objectContaining({ to: "owner@example.com", subject: "[SEA] Error on /admin/students" }));
  });

  it("does not record or email a redirect", async () => {
    await captureServerError(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/x" }), ctx, now);
    expect(db.errorEvent.upsert).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it("stays quiet when the alert was already sent within the hour (another request claimed it)", async () => {
    db.errorEvent.updateMany.mockResolvedValue({ count: 0 });
    await captureServerError(new Error("boom"), ctx, now);
    expect(db.errorEvent.upsert).toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
    const claim = db.errorEvent.updateMany.mock.calls[0][0];
    expect(claim.where.OR).toEqual([{ lastAlertedAt: null }, { lastAlertedAt: { lt: new Date(now.getTime() - 3_600_000) } }]);
  });

  it("alerts again when an error that was marked fixed comes back", async () => {
    db.errorEvent.findUnique.mockResolvedValue({ resolvedAt: new Date("2026-10-07T00:00:00Z") });
    await captureServerError(new Error("boom"), ctx, now);
    const update = db.errorEvent.upsert.mock.calls[0][0].update;
    expect(update).toMatchObject({ resolvedAt: null, lastAlertedAt: null });
  });

  it("holds back emails past the hourly cap but still records the error", async () => {
    limiter.mockResolvedValue({ allowed: false, retryAfterSec: 600 });
    await captureServerError(new Error("boom"), ctx, now);
    expect(db.errorEvent.upsert).toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it("never throws, even if the database or email is down", async () => {
    db.errorEvent.findUnique.mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(captureServerError(new Error("boom"), ctx, now)).resolves.toBeUndefined();
    db.errorEvent.findUnique.mockResolvedValue(null);
    email.mockRejectedValue(new Error("resend down"));
    await expect(captureServerError(new Error("boom"), ctx, now)).resolves.toBeUndefined();
    spy.mockRestore();
  });
});

describe("captureServerError limits", () => {
  it("does not add new distinct errors once the table is full, but still counts known ones", async () => {
    db.errorEvent.count.mockResolvedValue(2000);
    await captureServerError(new Error("a brand new failure"), ctx, now);
    expect(db.errorEvent.upsert).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();

    db.errorEvent.findUnique.mockResolvedValue({ resolvedAt: null });
    await captureServerError(new Error("a brand new failure"), ctx, now);
    expect(db.errorEvent.upsert).toHaveBeenCalled();
  });

  it("stores no personal details quoted in a database error", async () => {
    const prismaStyle = new Error("\nInvalid `prisma.user.create()` invocation in /app/x.ts:10:5\n\n  data: {\n    email: \"ada@example.com\",\n    passwordHash: \"$2b$10$" + "a".repeat(53) + "\"\n  }\n\nUnique constraint failed on the fields: (`email`)");
    await captureServerError(prismaStyle, ctx, now);
    const created = db.errorEvent.upsert.mock.calls[0][0].create;
    const stored = JSON.stringify(created);
    expect(stored).not.toContain("ada@example.com");
    expect(stored).not.toContain("$2b$");
    expect(created.message).toContain("Unique constraint failed");
    expect(created.stack ?? "").not.toContain("Invalid `prisma");
  });
});
