import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hit, waitMessage } from "@/lib/rate-limit";
import { consumeSecondFactor } from "@/lib/two-step";
import { UserError } from "@/lib/user-error";

/**
 * "Is this really the owner at the keyboard?" for actions that can't be undone.
 * Needs the account password, and a current two-step code (or a recovery code)
 * when two-step sign-in is on. Wrong answers are rate-limited like sign-in.
 */
export async function confirmOwnerIdentity(ownerId: string, password: string, code: string): Promise<void> {
  const limit = await hit(`owner-reauth:${ownerId}`, 8, 900);
  if (!limit.allowed) throw new UserError(waitMessage(limit.retryAfterSec));

  const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, passwordHash: true, totpSecret: true, totpEnabledAt: true, totpLastStep: true } });
  if (!owner || !password || !(await bcrypt.compare(password, owner.passwordHash))) throw new UserError("That password is not right.");
  if (owner.totpEnabledAt && !(await consumeSecondFactor(owner, String(code ?? "")))) {
    throw new UserError("That code didn't work. Use the 6-digit code from your authenticator app, or a recovery code.");
  }
}
