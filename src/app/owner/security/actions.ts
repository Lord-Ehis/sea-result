"use server";

import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { hit, waitMessage } from "@/lib/rate-limit";
import { recordPlatformEvent } from "@/lib/platform-events";
import { generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, otpauthUri, verifyTotp } from "@/lib/totp";
import { consumeSecondFactor } from "@/lib/two-step";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";

// Two-step sign-in for the platform owner's own account. Every action checks
// the caller is the platform owner and only ever touches that caller's row.

async function requirePlatformOwner() {
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") throw new Error("Not authorized.");
  return session.user.id;
}

async function guessLimit(ownerId: string) {
  const limit = await hit(`two-step-setup:${ownerId}`, 10, 900);
  if (!limit.allowed) throw new UserError(waitMessage(limit.retryAfterSec));
}

/** Starts (or restarts) setup: a fresh secret, saved but not switched on until a code from the app proves it works. */
export async function startTwoStepSetup(): Promise<ActionResult<{ secret: string; qr: string }>> {
  const ownerId = await requirePlatformOwner();
  return toResult(async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: ownerId }, select: { email: true, totpEnabledAt: true } });
    if (user.totpEnabledAt) throw new UserError("Two-step sign-in is already on.");
    const secret = generateTotpSecret();
    await prisma.user.update({ where: { id: ownerId }, data: { totpSecret: encryptJson({ secret }) } });
    const qr = await QRCode.toDataURL(otpauthUri(secret, user.email), { margin: 1, width: 220 });
    return { secret, qr };
  });
}

/** Checks the first code from the app, switches two-step on, and hands back the recovery codes: the only time they are shown. */
export async function confirmTwoStepSetup(code: string): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  const ownerId = await requirePlatformOwner();
  return toResult(async () => {
    await guessLimit(ownerId);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: ownerId }, select: { totpSecret: true, totpEnabledAt: true } });
    if (user.totpEnabledAt) throw new UserError("Two-step sign-in is already on.");
    if (!user.totpSecret) throw new UserError("Start the setup again to get a new QR code.");

    const step = verifyTotp(decryptJson<{ secret: string }>(user.totpSecret).secret, String(code ?? ""), new Date(), null);
    if (step === null) throw new UserError("That code didn't match. Check the 6-digit code in your app and try again.");

    const recoveryCodes = generateRecoveryCodes();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: ownerId },
        data: { totpEnabledAt: new Date(), totpLastStep: step, totpRecoveryHashes: recoveryCodes.map(hashRecoveryCode) },
      });
      await recordPlatformEvent(tx, { action: "TWO_STEP_ENABLED", actorUserId: ownerId, targetUserId: ownerId });
    });
    revalidatePath("/owner/security");
    revalidatePath("/owner/dashboard");
    return { recoveryCodes };
  });
}

// Turning it off, or making new recovery codes, needs both the password and a
// current code, so someone who finds the browser signed in can't weaken it.
async function proveItsTheOwner(ownerId: string, password: string, code: string) {
  await guessLimit(ownerId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ownerId }, select: { id: true, passwordHash: true, totpSecret: true, totpEnabledAt: true, totpLastStep: true } });
  if (!user.totpEnabledAt) throw new UserError("Two-step sign-in is not on.");
  if (!password || !(await bcrypt.compare(password, user.passwordHash))) throw new UserError("That password is not right.");
  if (!(await consumeSecondFactor(user, String(code ?? "")))) throw new UserError("That code didn't work. Use the 6-digit code from your app, or a recovery code.");
}

export async function disableTwoStep(input: { password: string; code: string }): Promise<ActionResult> {
  const ownerId = await requirePlatformOwner();
  return toResult(async () => {
    await proveItsTheOwner(ownerId, input.password, input.code);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: ownerId }, data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null, totpRecoveryHashes: [] } });
      await recordPlatformEvent(tx, { action: "TWO_STEP_DISABLED", actorUserId: ownerId, targetUserId: ownerId });
    });
    revalidatePath("/owner/security");
    revalidatePath("/owner/dashboard");
    return {};
  });
}

export async function regenerateRecoveryCodes(input: { password: string; code: string }): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  const ownerId = await requirePlatformOwner();
  return toResult(async () => {
    await proveItsTheOwner(ownerId, input.password, input.code);
    const recoveryCodes = generateRecoveryCodes();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: ownerId }, data: { totpRecoveryHashes: recoveryCodes.map(hashRecoveryCode) } });
      await recordPlatformEvent(tx, { action: "RECOVERY_CODES_REGENERATED", actorUserId: ownerId, targetUserId: ownerId });
    });
    revalidatePath("/owner/security");
    return { recoveryCodes };
  });
}
