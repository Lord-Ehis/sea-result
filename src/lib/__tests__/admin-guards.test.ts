import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Regression guard for campus access (RT-13). Every admin page, action and
// route must get its identity from src/lib/admin-access.ts — never straight
// from the session — and must either be school-wide (requireFullAdmin*) or
// build its queries with the campus-scope helpers. A future admin page that
// forgets to do either fails here instead of quietly showing every campus.

const ROOT = join(process.cwd(), "src", "app", "admin");
const SCOPED_ENTRY = /(^|[\\/])(page\.tsx|[\w-]*actions\.ts|route\.ts|layout\.tsx)$/;

// Files that legitimately don't take an admin identity, and why.
const EXEMPT = new Map<string, string>([
  ["billing/callback/page.tsx", "Paystack's return redirect; it verifies the payment reference, not a person"],
  ["audit/export/route.ts", "uses getAdminAccess directly (checked below like the others)"],
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(ROOT)
  .filter((f) => SCOPED_ENTRY.test(f))
  .map((f) => ({ path: relative(ROOT, f).replace(/\\/g, "/"), text: readFileSync(f, "utf8") }))
  .filter((f) => !EXEMPT.has(f.path) || f.path === "audit/export/route.ts");

describe("admin pages and actions use the shared access helper", () => {
  it("finds the admin files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((f) => [f.path, f.text] as const))("%s takes its identity from admin-access", (path, text) => {
    // layout.tsx reads the session only for the display name; the access decision still comes from getAdminAccess.
    if (path !== "layout.tsx") {
      expect(text, `${path} must not read the session directly`).not.toMatch(/from "@\/lib\/auth"/);
    }
    expect(text, `${path} must import @/lib/admin-access`).toMatch(/from "@\/lib\/admin-access"/);
  });

  it.each(files.map((f) => [f.path, f.text] as const))("%s is either school-wide or campus-scoped", (path, text) => {
    const usesDatabase = /from "@\/lib\/prisma"/.test(text);
    if (!usesDatabase) return;
    // School-wide: requires a full admin, or (Billing, which a lapsed campus admin lands on) checks campusIds itself.
    const schoolWide = /requireFullAdmin(Page)?\b/.test(text) || /access\.campusIds !== null/.test(text);
    const scopes = /from "@\/lib\/(campus-scope|audit-query)"/.test(text);
    // Pages that only forward to a scoped loader (and don't query campus data themselves) are listed here.
    const forwardsToScopedCode = ["layout.tsx", "notifications/actions.ts"].includes(path);
    expect(schoolWide || scopes || forwardsToScopedCode, `${path} queries the database but is neither school-wide nor campus-scoped`).toBe(true);
  });

  it("no admin file defines its own copy of the old school-only check", () => {
    for (const f of files) expect(f.text, f.path).not.toMatch(/session\.user\.role !== "SCHOOL_ADMIN"/);
  });

  it("school-wide features refuse campus admins", () => {
    for (const path of ["result-templates/page.tsx", "result-templates/actions.ts", "result-templates/version-actions.ts", "result-templates/annual-actions.ts", "billing/page.tsx", "billing/actions.ts", "domain/page.tsx", "domain/actions.ts", "deletion-request/page.tsx", "deletion-request/actions.ts", "team/page.tsx", "team/actions.ts"]) {
      const f = files.find((x) => x.path === path);
      expect(f, `${path} should exist`).toBeTruthy();
      expect(f!.text, `${path} must refuse campus admins`).toMatch(/requireFullAdmin(Page)?\b|access\.campusIds !== null/);
    }
  });
});
