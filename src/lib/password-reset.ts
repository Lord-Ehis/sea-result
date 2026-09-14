import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Creates a password-reset/set-password token for a user and returns the
 * raw token to put in an email link. Only the hash is stored, so a
 * database read alone can't be used to reset the account.
 */
export async function createPasswordResetToken(userId: string) {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return rawToken;
}

/**
 * Validates a raw token from a reset link. Returns the associated userId
 * if it's unused and unexpired, throws a generic error otherwise (never
 * reveals which specific check failed).
 */
export async function consumePasswordResetToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new Error("This link is invalid or has expired. Request a new one.");
  }

  await prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return record.userId;
}
