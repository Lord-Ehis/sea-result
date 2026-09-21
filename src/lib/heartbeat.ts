import { prisma } from "@/lib/prisma";

// Records the last time something we can only see from outside happened, so the
// owner's Go-live page can tell "working" from "never seen".
export type HeartbeatKey = "paystack_webhook" | "cron_subscriptions";

/** Never throws: a failure to note the time must not break the thing being noted. */
export async function touchHeartbeat(key: HeartbeatKey) {
  try {
    const now = new Date();
    await prisma.systemHeartbeat.upsert({ where: { key }, create: { key, lastAt: now }, update: { lastAt: now } });
  } catch {
    // ignore
  }
}

export async function getHeartbeat(key: HeartbeatKey): Promise<Date | null> {
  const row = await prisma.systemHeartbeat.findUnique({ where: { key } });
  return row?.lastAt ?? null;
}
