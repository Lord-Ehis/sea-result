import { beforeEach, describe, expect, it, vi } from "vitest";

// The actions are thin: who may call them, which messages they pick, and what
// they report. The provider calls and database are faked.
const db = vi.hoisted(() => ({ notification: { findMany: vi.fn() } }));
const authMock = vi.hoisted(() => vi.fn());
const resend = vi.hoisted(() => vi.fn());
const email = vi.hoisted(() => vi.fn());
const sms = vi.hoisted(() => vi.fn());
const limiter = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: email }));
vi.mock("@/lib/sms", () => ({ sendSms: sms }));
vi.mock("@/lib/rate-limit", () => ({ hit: limiter, waitMessage: (s: number) => `Wait ${s}s.` }));
vi.mock("@/lib/notifications", () => ({
  resendFailedNotification: resend,
  runWithConcurrency: async (tasks: (() => Promise<unknown>)[]) => {
    for (const t of tasks) await t();
  },
}));

import { retryFailedMessages, sendTestMessage } from "@/app/owner/messages/actions";

const asOwner = () => authMock.mockResolvedValue({ user: { id: "owner-1", role: "PLATFORM_OWNER" } });

beforeEach(() => {
  vi.clearAllMocks();
  asOwner();
  limiter.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
});

describe("retryFailedMessages", () => {
  it("refuses anyone who is not the platform owner", async () => {
    authMock.mockResolvedValue({ user: { id: "a1", role: "SCHOOL_ADMIN" } });
    await expect(retryFailedMessages()).rejects.toThrow("Not authorized");
    authMock.mockResolvedValue(null);
    await expect(retryFailedMessages()).rejects.toThrow("Not authorized");
    expect(db.notification.findMany).not.toHaveBeenCalled();
  });

  it("only picks recent failed result notifications, optionally for one school", async () => {
    db.notification.findMany.mockResolvedValue([]);
    await retryFailedMessages({ schoolId: "s1" });
    const args = db.notification.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ status: "FAILED", event: { in: ["RESULT_PUBLISHED", "RESULT_AMENDED"] }, schoolId: "s1" });
    expect(args.where.createdAt.gte).toBeInstanceOf(Date);
    await retryFailedMessages();
    expect(db.notification.findMany.mock.calls[1][0].where).not.toHaveProperty("schoolId");
  });

  it("re-sends each one under its own school and tallies the outcomes", async () => {
    db.notification.findMany.mockResolvedValue([{ id: "n1", schoolId: "s1" }, { id: "n2", schoolId: "s2" }, { id: "n3", schoolId: "s2" }]);
    resend.mockResolvedValueOnce("sent").mockResolvedValueOnce("failed").mockResolvedValueOnce("skipped");
    const result = await retryFailedMessages();
    expect(resend.mock.calls).toEqual([["n1", "s1"], ["n2", "s2"], ["n3", "s2"]]);
    expect(result).toEqual({ ok: true, sent: 1, failed: 1, skipped: 1, moreLeft: false });
  });

  it("does at most 200 in a click and says when more are left", async () => {
    db.notification.findMany.mockResolvedValue(Array.from({ length: 201 }, (_, i) => ({ id: `n${i}`, schoolId: "s1" })));
    resend.mockResolvedValue("sent");
    const result = await retryFailedMessages();
    expect(resend).toHaveBeenCalledTimes(200);
    expect(result).toMatchObject({ ok: true, sent: 200, moreLeft: true });
  });
});

describe("sendTestMessage", () => {
  it("refuses anyone who is not the platform owner, before sending anything", async () => {
    authMock.mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    await expect(sendTestMessage({ channel: "EMAIL", to: "me@example.com" })).rejects.toThrow("Not authorized");
    expect(email).not.toHaveBeenCalled();
  });

  it("sends an email and an SMS to a valid, tidied destination", async () => {
    expect(await sendTestMessage({ channel: "EMAIL", to: " me@example.com " })).toEqual({ ok: true });
    expect(email).toHaveBeenCalledWith(expect.objectContaining({ to: "me@example.com" }));
    expect(await sendTestMessage({ channel: "SMS", to: "0801 234" })).toMatchObject({ ok: false });
    expect(await sendTestMessage({ channel: "SMS", to: "+234 801 234 5678" })).toEqual({ ok: true });
    expect(sms).toHaveBeenCalledWith(expect.objectContaining({ to: "+2348012345678" }));
  });

  it("rejects a bad destination without calling the provider", async () => {
    const result = await sendTestMessage({ channel: "EMAIL", to: "not-an-email" });
    expect(result).toEqual({ ok: false, error: "Enter a valid email address.", hint: null });
    expect(email).not.toHaveBeenCalled();
  });

  it("reports the provider's exact reply, with a plain-language hint", async () => {
    email.mockRejectedValue(new Error("Resend request failed (403): You can only send testing emails to your own email address"));
    const result = await sendTestMessage({ channel: "EMAIL", to: "someone@example.com" });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("(403)"), hint: expect.stringMatching(/verify/i) });
  });

  it("is limited to a few a hour", async () => {
    limiter.mockResolvedValue({ allowed: false, retryAfterSec: 90 });
    expect(await sendTestMessage({ channel: "EMAIL", to: "me@example.com" })).toEqual({ ok: false, error: "Wait 90s.", hint: null });
    expect(email).not.toHaveBeenCalled();
  });
});
