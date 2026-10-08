import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HELP_VIDEOS, formatLength } from "@/lib/help-videos";
import { campusAdminNavItems, parentNavItems, schoolAdminNavItems, teacherNavItems } from "@/lib/nav-config";

const read = (...p: string[]) => readFileSync(join(process.cwd(), "src", ...p), "utf8");

describe("help videos", () => {
  it.each(Object.values(HELP_VIDEOS).map((v) => [v.id, v] as const))("%s: the video file exists and is a sensible size", (_id, v) => {
    const path = join(process.cwd(), "public", v.file);
    expect(existsSync(path), `${v.file} should be in public/`).toBe(true);
    const size = statSync(path).size;
    expect(size).toBeGreaterThan(100_000);
    expect(size).toBeLessThan(10 * 1024 * 1024);
    expect(v.steps.length).toBeGreaterThan(3);
    expect(v.file).toMatch(/^\/help\/[a-z-]+\.mp4$/);
  });

  it("has unique ids, so each section's link anchor is its own", () => {
    const ids = Object.values(HELP_VIDEOS).map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("shows the length in minutes", () => {
    expect(formatLength(111)).toBe("2 min");
    expect(formatLength(91)).toBe("2 min");
  });
});

describe("help pages", () => {
  it("every role that has a Help page has a menu entry pointing to it", () => {
    expect(schoolAdminNavItems.some((i) => i.href === "/admin/help")).toBe(true);
    expect(campusAdminNavItems.some((i) => i.href === "/admin/help")).toBe(true);
    expect(teacherNavItems.some((i) => i.href === "/teacher/help")).toBe(true);
    expect(parentNavItems.some((i) => i.href === "/parent/help")).toBe(true);
  });

  it("each page shows only its own role's videos", () => {
    expect(read("app", "teacher", "help", "page.tsx")).toMatch(/HELP_VIDEOS\.teacher/);
    expect(read("app", "teacher", "help", "page.tsx")).not.toMatch(/schoolAdmin|resultTemplate|parent/);
    expect(read("app", "parent", "help", "page.tsx")).toMatch(/HELP_VIDEOS\.parent/);
    expect(read("app", "parent", "help", "page.tsx")).not.toMatch(/schoolAdmin|resultTemplate|teacher/);
  });

  it("a campus admin is not shown how to build result templates, which they cannot open", () => {
    const page = read("app", "admin", "help", "page.tsx");
    expect(page).toMatch(/access\.campusIds === null \? \[HELP_VIDEOS\.schoolAdmin, HELP_VIDEOS\.resultTemplate\] : \[HELP_VIDEOS\.schoolAdmin\]/);
  });
});
