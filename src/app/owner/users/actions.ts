"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { changeUserEmail } from "@/lib/change-email";
import { createPasswordResetToken } from "@/lib/password-reset";
import { createAndSendNotification } from "@/lib/notifications";
import { recordPlatformEvent } from "@/lib/platform-events";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";

async function requirePlatformOwner() {
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") throw new Error("Not authorized.");
  return session.user.id;
}

// Only school staff and parents can be helped from here. Other platform owner
// accounts, and anything without a school, are never touched.
async function findSupportedUser(userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, role: { not: "PLATFORM_OWNER" }, schoolId: { not: null } } });
  if (!user?.schoolId) throw new UserError("Account not found.");
  return { ...user, schoolId: user.schoolId };
}

/** Replaces someone's sign-in email (they lost their inbox) and emails them a link to set a new password. */
export async function changeUserEmailAsOwner(input: { userId: string; email: string }): Promise<ActionResult<{ linkSent: boolean; email: string }>> {
  const ownerId = await requirePlatformOwner();
  return toResult(async () => {
    const user = await findSupportedUser(input.userId);
    const result = await changeUserEmail({
      targetUserId: user.id,
      newEmail: input.email,
      actor: { userId: ownerId, role: "PLATFORM_OWNER", label: "the Sophie Educational Assistant team" },
    });
    revalidatePath("/owner/users");
    return { linkSent: result.linkSent, email: result.newEmail };
  });
}

/** Emails the account a fresh link to set a password: the "resend my invite" and "I forgot my password and can't get the email" case. */
export async function sendPasswordLink(userId: string): Promise<ActionResult<{ delivered: boolean }>> {
  const ownerId = await requirePlatformOwner();
  return toResult(async () => {
    const user = await findSupportedUser(userId);
    if (!user.isActive) throw new UserError("This account is switched off, so a password link would not let them in.");

    const token = await createPasswordResetToken(user.id);
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const notificationId = await createAndSendNotification({
      schoolId: user.schoolId,
      userId: user.id,
      channel: "EMAIL",
      event: "PASSWORD_RESET",
      recipient: user.email,
      subject: "Set your Sophie Educational Assistant password",
      message: `Hi ${user.name},\n\nHere is a link to set a password for your Sophie Educational Assistant account (it expires in 1 hour):\n${baseUrl}/reset-password?token=${token}\n\nIf you did not expect this, you can ignore this email.`,
    });
    const sent = await prisma.notification.findUnique({ where: { id: notificationId }, select: { status: true } });
    const delivered = sent?.status === "SENT";

    await recordPlatformEvent(prisma, { action: "PASSWORD_LINK_SENT", actorUserId: ownerId, schoolId: user.schoolId, targetUserId: user.id, metadata: { delivered } });
    revalidatePath("/owner/audit");
    return { delivered };
  });
}
