import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_CHAPTERS, HELP_VIDEOS, formatLength } from "@/lib/help-videos";
import { campusAdminNavItems, parentNavItems, schoolAdminNavItems, teacherNavItems } from "@/lib/nav-config";

const read = (...p: string[]) => readFileSync(join(process.cwd(), "src", ...p), "utf8");
const allVideos = [...ADMIN_CHAPTERS, ...Object.values(HELP_VIDEOS)];

describe("help videos", () => {
  it.each(allVideos.map((v) => [v.id, v] as const))("%s: the video file exists and is a sensible size", (_id, v) => {
    const path = join(process.cwd(), "public", v.file);
    expect(existsSync(path), `${v.file} should be in public/`).toBe(true);
    const size = statSync(path).size;
    expect(size).toBeGreaterThan(100_000);
    expect(size).toBeLessThan(10 * 1024 * 1024);
    expect(v.steps.length).toBeGreaterThan(3);
    expect(v.file).toMatch(/^\/help\/[a-z0-9-]+\.mp4$/);
  });

  it("has unique ids, so each section's link anchor is its own", () => {
    const ids = allVideos.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps no video in public/help that no page uses", () => {
    const used = new Set(allVideos.map((v) => v.file.replace("/help/", "")));
    const onDisk = readdirSync(join(process.cwd(), "public", "help")).filter((f) => f.endsWith(".mp4"));
    expect(onDisk.filter((f) => !used.has(f))).toEqual([]);
  });

  it("lists the admin chapters in order, numbered 1 to 5", () => {
    expect(ADMIN_CHAPTERS).toHaveLength(5);
    ADMIN_CHAPTERS.forEach((c, i) => expect(c.title.startsWith(`${i + 1}. `), c.title).toBe(true));
    ADMIN_CHAPTERS.forEach((c) => expect(c.id).toMatch(/^admin-\d-/));
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
    expect(read("app", "teacher", "help", "page.tsx")).not.toMatch(/ADMIN_CHAPTERS|resultTemplate|parent/);
    expect(read("app", "parent", "help", "page.tsx")).toMatch(/HELP_VIDEOS\.parent/);
    expect(read("app", "parent", "help", "page.tsx")).not.toMatch(/ADMIN_CHAPTERS|resultTemplate|teacher/);
  });

  it("the main school admin gets every chapter and the template guide; a campus admin gets chapters 1 to 4, with a note", () => {
    const page = read("app", "admin", "help", "page.tsx");
    expect(page).toMatch(/const everything = access\.campusIds === null/);
    expect(page).toMatch(/everything \? \[\.\.\.ADMIN_CHAPTERS, HELP_VIDEOS\.resultTemplate\] : ADMIN_CHAPTERS\.slice\(0, 4\)/);
    expect(page).toMatch(/note=\{note\}/);
    expect(page).toMatch(/billing/); // the note says why some steps don't apply to them
  });
});
