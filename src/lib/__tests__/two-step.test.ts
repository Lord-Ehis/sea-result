import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ user: { updateMany: vi.fn() }, $executeRaw: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

process.env.PROVIDER_CONFIG_KEY = Buffer.alloc(32, 7).toString("base64");

import { encryptJson } from "@/lib/crypto";
import { stepAt, totpAtStep } from "@/lib/totp";
import { consumeSecondFactor } from "@/lib/two-step";

const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const now = new Date(1_000_000_000_000);
const user = (over = {}) => ({ id: "u1", totpSecret: encryptJson({ secret: SECRET }), totpEnabledAt: new Date(), totpLastStep: null as number | null, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  db.user.updateMany.mockResolvedValue({ count: 1 });
  db.$executeRaw.mockResolvedValue(1);
});

describe("consumeSecondFactor", () => {
  it("does nothing for an account without two-step switched on", async () => {
    expect(await consumeSecondFactor(user({ totpEnabledAt: null }), "123456", now)).toBeNull();
    expect(await consumeSecondFactor(user({ totpSecret: null }), "123456", now)).toBeNull();
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it("accepts the right app code and records the step it used", async () => {
    const code = totpAtStep(SECRET, stepAt(now));
    expect(await consumeSecondFactor(user(), code, now)).toBe("totp");
    expect(db.user.updateMany.mock.calls[0][0].data).toEqual({ totpLastStep: stepAt(now) });
  });

  it("rejects a wrong code without touching the database", async () => {
    expect(await consumeSecondFactor(user(), "000000", now)).toBeNull();
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a code whose step was already used, even if it is still in the window", async () => {
    const step = stepAt(now);
    expect(await consumeSecondFactor(user({ totpLastStep: step }), totpAtStep(SECRET, step), now)).toBeNull();
  });

  it("refuses when another request claimed the same step first", async () => {
    db.user.updateMany.mockResolvedValue({ count: 0 });
    expect(await consumeSecondFactor(user(), totpAtStep(SECRET, stepAt(now)), now)).toBeNull();
  });

  it("uses a recovery code once: the hash is removed, and a second try finds nothing", async () => {
    expect(await consumeSecondFactor(user(), "abcde-fgh23", now)).toBe("recovery");
    db.$executeRaw.mockResolvedValue(0);
    expect(await consumeSecondFactor(user(), "ABCDEFGH23", now)).toBeNull();
  });
});
