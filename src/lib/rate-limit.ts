import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

// Fixed-window throttling for the public, unauthenticated endpoints (result
// lookup, /verify) so a code or a student's name can't be guessed by
// brute force. Counters live in the database (`rate_limits`) because
// in-memory ones don't survive across serverless instances. If the database
// hiccups the check fails *open* — the page itself needs the same database,
// so throttling must never be the reason a real parent is locked out.

const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;

function windowStart(windowSec: number, now = Date.now()): Date {
  const size = windowSec * 1000;
  return new Date(Math.floor(now / size) * size);
}

/** A stable, non-reversible id for the caller (the address is hashed, never stored). */
export async function callerId(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export type LimitResult = { allowed: boolean; retryAfterSec: number };

/** Counts one attempt against `key` and says whether it is still within `limit` for the window. */
export async function hit(key: string, limit: number, windowSec: number): Promise<LimitResult> {
  try {
    const start = windowStart(windowSec);
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO rate_limits ("key", "windowStart", "count") VALUES (${key}, ${start}, 1)
      ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = rate_limits."count" + 1
      RETURNING "count"`;
    if (Math.random() < 0.01) {
      void prisma.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - PRUNE_AFTER_MS) } } }).catch(() => {});
    }
    const count = Number(rows[0]?.count ?? 1);
    return { allowed: count <= limit, retryAfterSec: Math.max(1, Math.ceil((start.getTime() + windowSec * 1000 - Date.now()) / 1000)) };
  } catch {
    return { allowed: true, retryAfterSec: 0 };
  }
}

/** Whether `key` is already over `limit` in the current window, without counting an attempt. */
export async function isOverLimit(key: string, limit: number, windowSec: number): Promise<LimitResult> {
  try {
    const start = windowStart(windowSec);
    const row = await prisma.rateLimit.findUnique({ where: { key_windowStart: { key, windowStart: start } } });
    return { allowed: (row?.count ?? 0) < limit, retryAfterSec: Math.max(1, Math.ceil((start.getTime() + windowSec * 1000 - Date.now()) / 1000)) };
  } catch {
    return { allowed: true, retryAfterSec: 0 };
  }
}

export function waitMessage(retryAfterSec: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return `Too many attempts. Please wait about ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`;
}
