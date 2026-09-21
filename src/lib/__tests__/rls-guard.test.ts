import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Supabase exposes the `public` schema through its Data API, so a table with
// Row Level Security off is readable and writable by anyone holding the public
// "anon" key. The migration 20260921180000_enable_rls switched RLS on for every
// table that existed then; this guard makes sure every table created AFTER it
// does the same, in the same migration that creates it.

const DIR = join(process.cwd(), "prisma", "migrations");
const RLS_MIGRATION = "20260921180000_enable_rls";

const migrations = readdirSync(DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => ({ name: d.name, sql: readFileSync(join(DIR, d.name, "migration.sql"), "utf8") }))
  .sort((a, b) => a.name.localeCompare(b.name));

describe("row level security on new tables", () => {
  it("has the migration that enables it everywhere", () => {
    const m = migrations.find((x) => x.name === RLS_MIGRATION);
    expect(m, "the enable-RLS migration should exist").toBeTruthy();
    expect(m!.sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(m!.sql).toMatch(/REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated/);
  });

  it("every table created after it enables RLS in the same migration", () => {
    const later = migrations.filter((m) => m.name > RLS_MIGRATION);
    for (const m of later) {
      const created = [...m.sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:"?public"?\.)?"([^"]+)"/gi)].map((x) => x[1]);
      for (const table of created) {
        const enabled = new RegExp(`ALTER TABLE\\s+(?:"?public"?\\.)?"?${table}"?\\s+ENABLE ROW LEVEL SECURITY`, "i").test(m.sql);
        expect(enabled, `${m.name} creates "${table}" without ENABLE ROW LEVEL SECURITY — add: ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`).toBe(true);
      }
    }
  });
});
