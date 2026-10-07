import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The owner's user search and audit log expose every school's people and
// history, and the support actions can sign someone back in. Each must check
// the caller is the platform owner itself, not rely only on the proxy.
const read = (...p: string[]) => readFileSync(join(process.cwd(), "src", "app", "owner", ...p), "utf8");

describe("owner-only pages and actions", () => {
  it("the user search and audit pages check the role before reading anything", () => {
    for (const page of [read("users", "page.tsx"), read("audit", "page.tsx"), read("adoption", "page.tsx"), read("revenue", "page.tsx")]) {
      expect(page).toMatch(/session\?\.user\.role !== "PLATFORM_OWNER"\) redirect\("\/login"\)/);
      const firstRead = page.search(/prisma\.|loadAdoption\(/);
      expect(firstRead).toBeGreaterThan(-1);
      expect(page.indexOf("PLATFORM_OWNER")).toBeLessThan(firstRead);
    }
  });

  it("the payments download checks the role itself and answers 401 otherwise", () => {
    const route = read("revenue", "export", "route.ts");
    expect(route).toMatch(/session\?\.user\.role !== "PLATFORM_OWNER"\) return new Response\("Not authorized\.", \{ status: 401 \}\)/);
    expect(route.indexOf("PLATFORM_OWNER")).toBeLessThan(route.indexOf("prisma."));
    expect(route).toMatch(/status: "SUCCESS"/);
  });

  it("every support action requires the platform owner", () => {
    const actions = read("users", "actions.ts");
    expect(actions).toMatch(/session\?\.user\.role !== "PLATFORM_OWNER"/);
    for (const fn of ["changeUserEmailAsOwner", "sendPasswordLink"]) {
      const body = actions.slice(actions.indexOf(`export async function ${fn}`));
      expect(body.slice(0, 200), `${fn} must call requirePlatformOwner first`).toMatch(/await requirePlatformOwner\(\)/);
    }
  });

  it("support actions never touch another platform owner's account, or one without a school", () => {
    const actions = read("users", "actions.ts");
    expect(actions).toMatch(/role: \{ not: "PLATFORM_OWNER" \}/);
    expect(actions).toMatch(/schoolId: \{ not: null \}/);
  });

  it("the search never lists platform owner accounts", () => {
    expect(read("users", "page.tsx")).toMatch(/role: role \?\? \{ not: "PLATFORM_OWNER" \}/);
  });

  it("switching a school off or on, and changing provider keys, are recorded", () => {
    expect(read("schools", "actions.ts")).toMatch(/SCHOOL_SUSPENDED/);
    const settings = read("settings", "actions.ts");
    expect(settings).toMatch(/PROVIDER_CONFIGURED/);
    expect(settings).toMatch(/PROVIDER_CLEARED/);
  });

  it("provider audit entries record which provider, never its keys", () => {
    const settings = read("settings", "actions.ts");
    const events = settings.match(/recordPlatformEvent\([^)]*\)/g) ?? [];
    expect(events.length).toBeGreaterThanOrEqual(4);
    for (const call of events) expect(call).not.toMatch(/apiKey|secretKey|publicKey|parsed/);
  });
});
