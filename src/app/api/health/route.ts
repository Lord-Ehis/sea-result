import { prisma } from "@/lib/prisma";

// For an uptime monitor (UptimeRobot, Better Stack…) to call every few minutes:
// 200 when the site is up and can reach its database, 503 when it can't.
// Public on purpose and reveals nothing: no version, no host, no error text.
export const dynamic = "force-dynamic";

const CHECK_TIMEOUT_MS = 8000;

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), CHECK_TIMEOUT_MS))]);
    return Response.json({ status: "ok" }, { headers });
  } catch {
    return Response.json({ status: "down" }, { status: 503, headers });
  }
}
