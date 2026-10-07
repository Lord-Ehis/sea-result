import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...p: string[]) => readFileSync(join(process.cwd(), "src", ...p), "utf8");

describe("two-step sign-in wiring", () => {
  it("sign-in asks for the code only after the password is right, and counts wrong codes as failed attempts", () => {
    const auth = read("lib", "auth.ts");
    expect(auth.indexOf("bcrypt.compare")).toBeLessThan(auth.indexOf("throw new TwoStepRequired()"));
    expect(auth).toMatch(/if \(user\.totpEnabledAt\)/);
    expect(auth).toMatch(/if \(!code\) throw new TwoStepRequired\(\)/);
    const start = auth.indexOf("if (!used)");
    const wrong = auth.slice(start, auth.indexOf("throw new InvalidTwoStepCode()", start));
    expect(wrong).toMatch(/hit\(keys\.account/);
  });

  it("the security page and every action require the platform owner", () => {
    expect(read("app", "owner", "security", "page.tsx")).toMatch(/session\?\.user\.role !== "PLATFORM_OWNER"\) redirect\("\/login"\)/);
    const actions = read("app", "owner", "security", "actions.ts");
    for (const fn of ["startTwoStepSetup", "confirmTwoStepSetup", "disableTwoStep", "regenerateRecoveryCodes"]) {
      const body = actions.slice(actions.indexOf(`export async function ${fn}`));
      expect(body.slice(0, 300), `${fn} must call requirePlatformOwner first`).toMatch(/await requirePlatformOwner\(\)/);
    }
  });

  it("turning two-step off or remaking recovery codes needs the password and a current code", () => {
    const actions = read("app", "owner", "security", "actions.ts");
    expect(actions).toMatch(/bcrypt\.compare\(password, user\.passwordHash\)/);
    expect(actions).toMatch(/consumeSecondFactor\(user/);
    for (const fn of ["disableTwoStep", "regenerateRecoveryCodes"]) {
      const body = actions.slice(actions.indexOf(`export async function ${fn}`));
      expect(body.slice(0, 500)).toMatch(/proveItsTheOwner/);
    }
  });

  it("the secret is stored encrypted and neither it nor the codes reach the audit log", () => {
    const actions = read("app", "owner", "security", "actions.ts");
    expect(actions).toMatch(/totpSecret: encryptJson\(/);
    for (const call of actions.match(/recordPlatformEvent\([^)]*\)/g) ?? []) expect(call).not.toMatch(/secret|recoveryCodes|metadata/i);
  });
});
