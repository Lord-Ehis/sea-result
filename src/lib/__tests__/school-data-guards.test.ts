import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";

const read = (...p: string[]) => readFileSync(join(process.cwd(), "src", ...p), "utf8");

describe("school data download", () => {
  it("is owner-only, checked before anything is loaded, rate-limited and logged", () => {
    const route = read("app", "owner", "schools", "[id]", "export", "route.ts");
    expect(route).toMatch(/session\?\.user\.role !== "PLATFORM_OWNER"\) return new Response\("Not authorized\.", \{ status: 401 \}\)/);
    expect(route.indexOf("PLATFORM_OWNER")).toBeLessThan(route.indexOf("loadSchoolExportData("));
    expect(route).toMatch(/hit\(`school-export:/);
    expect(route).toMatch(/action: "SCHOOL_DATA_EXPORTED"/);
    expect(route).toMatch(/no-store/);
  });

  it("never selects a password hash, token or provider key", () => {
    const source = read("lib", "school-data.ts");
    const loader = source.slice(source.indexOf("export async function loadSchoolExportData"));
    expect(loader.length).toBeGreaterThan(500);
    expect(loader).not.toMatch(/passwordHash|totpSecret|totpRecoveryHashes|PasswordResetToken|providerSetting/i);
  });
});

describe("school data deletion", () => {
  it("the action requires the owner first and re-checks identity before deleting", () => {
    const actions = read("app", "owner", "schools", "actions.ts");
    const body = actions.slice(actions.indexOf("export async function deleteSchoolData"));
    expect(body.slice(0, 300)).toMatch(/await requirePlatformOwner\(\)/);
    expect(body.indexOf("confirmOwnerIdentity(")).toBeGreaterThan(-1);
    expect(body.indexOf("confirmOwnerIdentity(")).toBeLessThan(body.indexOf("deleteSchoolRows("));
    expect(body.indexOf('school.status === "ACTIVE"')).toBeLessThan(body.indexOf("deleteSchoolRows("));
  });

  it("the permanent audit line is written in the same transaction as the deletion", () => {
    const actions = read("app", "owner", "schools", "actions.ts");
    const tx = actions.slice(actions.indexOf("prisma.$transaction(", actions.indexOf("deleteSchoolData")));
    expect(tx.indexOf("deleteSchoolRows(tx")).toBeLessThan(tx.indexOf('recordPlatformEvent(tx, { action: "SCHOOL_DATA_DELETED"'));
    expect(tx).toMatch(/timeout: 120_000/);
  });
});

// confirmOwnerIdentity itself, with the database and sign-in faked.
const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }));
const limiter = vi.hoisted(() => vi.fn());
const second = vi.hoisted(() => vi.fn());
const compare = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/rate-limit", () => ({ hit: limiter, waitMessage: (s: number) => `Wait ${s}s.` }));
vi.mock("@/lib/two-step", () => ({ consumeSecondFactor: second }));
vi.mock("bcryptjs", () => ({ default: { compare } }));

import { confirmOwnerIdentity } from "@/lib/owner-reauth";

describe("confirmOwnerIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limiter.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
    compare.mockResolvedValue(true);
    second.mockResolvedValue("totp");
    db.user.findUnique.mockResolvedValue({ id: "o1", passwordHash: "h", totpSecret: "s", totpEnabledAt: null, totpLastStep: null });
  });

  it("accepts the right password when two-step is off", async () => {
    await expect(confirmOwnerIdentity("o1", "pw", "")).resolves.toBeUndefined();
    expect(second).not.toHaveBeenCalled();
  });

  it("rejects a wrong or missing password", async () => {
    compare.mockResolvedValue(false);
    await expect(confirmOwnerIdentity("o1", "bad", "")).rejects.toThrow("That password is not right.");
    await expect(confirmOwnerIdentity("o1", "", "")).rejects.toThrow("That password is not right.");
  });

  it("also needs a good code when two-step is on", async () => {
    db.user.findUnique.mockResolvedValue({ id: "o1", passwordHash: "h", totpSecret: "s", totpEnabledAt: new Date(), totpLastStep: null });
    await expect(confirmOwnerIdentity("o1", "pw", "123456")).resolves.toBeUndefined();
    second.mockResolvedValue(null);
    await expect(confirmOwnerIdentity("o1", "pw", "000000")).rejects.toThrow(/code didn't work/);
  });

  it("is rate-limited", async () => {
    limiter.mockResolvedValue({ allowed: false, retryAfterSec: 120 });
    await expect(confirmOwnerIdentity("o1", "pw", "")).rejects.toThrow("Wait 120s.");
    expect(compare).not.toHaveBeenCalled();
  });
});
