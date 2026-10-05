import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The email-change actions are the account-recovery path, so each must check
// who is asking before it touches anyone's account.
const read = (...p: string[]) => readFileSync(join(process.cwd(), "src", "app", ...p), "utf8");
const body = (text: string, fn: string) => text.slice(text.indexOf(`export async function ${fn}`));

describe("who may change a sign-in email", () => {
  it("teachers: a school admin, only within their own campuses", () => {
    const fn = body(read("admin", "teachers", "actions.ts"), "changeTeacherEmail");
    expect(fn).toMatch(/getAdminAccess\(\)/);
    expect(fn).toMatch(/findTeacherInScope/);
    expect(fn).toMatch(/assertAccountOnlyInScope/);
  });

  it("campus admins: only the main admin, and never the main admin's own account", () => {
    const fn = body(read("admin", "team", "actions.ts"), "changeCampusAdminEmail");
    expect(fn).toMatch(/requireFullAdmin\(\)/);
    expect(fn).toMatch(/findCampusAdmin/);
  });

  it("school admins: only the platform owner", () => {
    const fn = body(read("owner", "schools", "actions.ts"), "changeSchoolAdminEmail");
    expect(fn).toMatch(/requirePlatformOwner\(\)/);
  });
});
