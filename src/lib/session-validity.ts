import { prisma } from "@/lib/prisma";

// Sign-ins are browser-held tokens, so nothing on the server "logs someone
// out". Instead every request asks whether the account behind the token is
// still the one the token was issued for: switched off, deleted, or given a
// different sign-in email all end the session (see the jwt callback in auth.ts).
// The answer is kept a few seconds per server instance, like school access
// (school-access-lookup.ts), so this isn't a database query per click.

const TTL_MS = 15_000;

type AccountRow = { email: string; isActive: boolean } | null;
const cache = new Map<string, { at: number; row: AccountRow }>();

/** Takes effect on this instance at once; other instances age their copy out within seconds. */
export function forgetUserSession(userId: string) {
  cache.delete(userId);
}

export function isSessionStillValid(tokenEmail: unknown, row: AccountRow): boolean {
  if (!row || !row.isActive) return false;
  if (typeof tokenEmail === "string" && tokenEmail !== row.email) return false;
  return true;
}

export async function checkSession(userId: string, tokenEmail: unknown): Promise<boolean> {
  const now = Date.now();
  let entry = cache.get(userId);
  if (!entry || now - entry.at >= TTL_MS) {
    try {
      const row = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, isActive: true } });
      entry = { at: now, row };
      cache.set(userId, entry);
    } catch (err) {
      // A database hiccup must not sign everyone out; the access helpers still check on every action.
      console.error("session validity check failed", err);
      return true;
    }
  }
  return isSessionStillValid(tokenEmail, entry.row);
}
