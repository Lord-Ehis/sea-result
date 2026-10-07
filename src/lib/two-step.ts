import { prisma } from "@/lib/prisma";
import { decryptJson } from "@/lib/crypto";
import { hashRecoveryCode, looksLikeRecoveryCode, verifyTotp } from "@/lib/totp";

// The database side of two-step sign-in: checking the second factor and, in
// the same breath, using it up, so a code can never be accepted twice even if
// two requests carry it at the same moment.

export type SecondFactorUser = { id: string; totpSecret: string | null; totpEnabledAt: Date | null };

export type SecondFactorResult = "totp" | "recovery" | null;

/**
 * Accepts either the 6-digit code from the authenticator app or one of the
 * unused recovery codes. Returns which one was used, or null when it is wrong
 * or was already used. Does nothing unless two-step is switched on for the user.
 */
export async function consumeSecondFactor(user: SecondFactorUser & { totpLastStep?: number | null }, input: string, now = new Date()): Promise<SecondFactorResult> {
  if (!user.totpEnabledAt || !user.totpSecret) return null;

  if (looksLikeRecoveryCode(input)) {
    // Removing the hash is the check: only one request can remove it.
    const removed = await prisma.$executeRaw`
      UPDATE users SET "totpRecoveryHashes" = array_remove("totpRecoveryHashes", ${hashRecoveryCode(input)})
      WHERE id = ${user.id} AND ${hashRecoveryCode(input)} = ANY("totpRecoveryHashes")`;
    return removed === 1 ? "recovery" : null;
  }

  const secret = decryptJson<{ secret: string }>(user.totpSecret).secret;
  const step = verifyTotp(secret, input, now, user.totpLastStep ?? null);
  if (step === null) return null;
  // Claim the step: if another request already did, this one is refused.
  const claimed = await prisma.user.updateMany({
    where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
    data: { totpLastStep: step },
  });
  return claimed.count === 1 ? "totp" : null;
}
