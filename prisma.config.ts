import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Vercel Preview builds have no database configured, and `prisma generate`
// (run by `postinstall`) only needs a well-formed URL — it never connects.
// The fallback applies to Preview builds alone: locally and in production a
// missing DATABASE_URL still fails loudly via env().
const previewOnlyUrl = process.env.VERCEL_ENV === "preview" ? "postgresql://preview:preview@localhost:5432/preview" : undefined;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? previewOnlyUrl ?? env("DATABASE_URL"),
  },
});
