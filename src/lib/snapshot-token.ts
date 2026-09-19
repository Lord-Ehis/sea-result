import { createHmac, timingSafeEqual } from "node:crypto";

// A short-lived pass to open one snapshot's printable page. The public lookup
// has no login, so after it verifies code + name it hands the viewer a token
// for exactly the snapshots it just showed. The verification code printed on
// the result is deliberately *not* an access token — it's meant to be shared
// with whoever needs to check a document's authenticity.

const DEFAULT_TTL_SECONDS = 30 * 60;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not configured.");
  return s;
}

function sign(snapshotId: string, expiresAt: number): string {
  return createHmac("sha256", secret()).update(`${snapshotId}.${expiresAt}`).digest("base64url");
}

export function signSnapshotToken(snapshotId: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${expiresAt}.${sign(snapshotId, expiresAt)}`;
}

export function verifySnapshotToken(snapshotId: string, token: string | undefined | null): boolean {
  if (!token) return false;
  const [expiresRaw, signature] = token.split(".");
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || !signature || expiresAt < Math.floor(Date.now() / 1000)) return false;

  const expected = Buffer.from(sign(snapshotId, expiresAt));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
