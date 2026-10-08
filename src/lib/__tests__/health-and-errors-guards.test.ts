import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...p: string[]) => readFileSync(join(process.cwd(), "src", ...p), "utf8");

describe("errors page and actions", () => {
  it("only the platform owner can read the list or mark errors fixed", () => {
    const page = read("app", "owner", "errors", "page.tsx");
    expect(page).toMatch(/session\?\.user\.role !== "PLATFORM_OWNER"\) redirect\("\/login"\)/);
    expect(page.indexOf("PLATFORM_OWNER")).toBeLessThan(page.indexOf("prisma.errorEvent"));
    const actions = read("app", "owner", "errors", "actions.ts");
    for (const fn of ["resolveError", "resolveAllErrors"]) {
      const body = actions.slice(actions.indexOf(`export async function ${fn}`));
      expect(body.slice(0, 200), `${fn} must call requirePlatformOwner first`).toMatch(/await requirePlatformOwner\(\)/);
    }
  });

  it("errors are recorded from Next's request-error hook, on the Node runtime only", () => {
    const hook = read("instrumentation.ts");
    expect(hook).toMatch(/export const onRequestError/);
    expect(hook).toMatch(/if \(process\.env\.NEXT_RUNTIME === "nodejs"\) \{\s+const \{ captureServerError \} = await import/);
    expect(hook).toMatch(/routePath: context\.routePath/);
    // Only the route pattern is passed on, never the request (its URL, headers and cookies).
    expect(hook).not.toMatch(/request\.(path|headers)/);
  });
});

describe("health check", () => {
  it("is public, uncached, and says nothing beyond up or down", () => {
    const route = read("app", "api", "health", "route.ts");
    expect(route).not.toMatch(/auth\(/);
    expect(route).toMatch(/force-dynamic/);
    expect(route).toMatch(/no-store/);
    expect(route).toMatch(/status: 503/);
    expect(route).not.toMatch(/error\.message|err\.message|process\.env/);
  });
});
