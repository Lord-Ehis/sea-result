import { prisma } from "@/lib/prisma";

// For an uptime monitor (UptimeRobot, Better Stack…) to call every few minutes:
// 200 when the site is up and can reach its database, 503 when it can't.
// Public on purpose and reveals nothing: no version, no host, no error text.
export const dynamic = "force-dynamic";

const CHECK_TIMEOUT_MS = 8000;
// Anyone can call this, so the database is asked at most once every few seconds per server instance.
const REUSE_MS = 5000;
let last: { at: number; ok: boolean } | null = null;

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  if (!last || Date.now() - last.at > REUSE_MS) {
    try {
      await Promise.race([prisma.$queryRaw`SELECT 1`, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), CHECK_TIMEOUT_MS))]);
      last = { at: Date.now(), ok: true };
    } catch {
      last = { at: Date.now(), ok: false };
    }
  }
  return last.ok ? Response.json({ status: "ok" }, { headers }) : Response.json({ status: "down" }, { status: 503, headers });
}
