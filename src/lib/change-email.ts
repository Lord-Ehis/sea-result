import { Prisma, type Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAndSendNotification } from "@/lib/notifications";
import { createPasswordResetToken } from "@/lib/password-reset";
import { UserError } from "@/lib/user-error";

// Recovery path for someone who has lost their inbox: a person with authority
// over the account (the school's admin, or the platform owner) replaces the
// sign-in email, and the person then sets a new password through the normal
// emailed link. Callers must have already checked the actor may manage this
// account; this function does not know about campuses or schools.

const emailSchema = z.string().trim().email("Enter a valid email address");

/** "jane.doe@example.com" -> "j***@example.com", so the old inbox is told where the account went without being handed the address. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

export async function changeUserEmail(input: {
  targetUserId: string;
  newEmail: string;
  actor: { userId: string; role: Role; label: string };
}): Promise<{ newEmail: string; linkSent: boolean }> {
  const parsed = emailSchema.safeParse(input.newEmail);
  if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Enter a valid email address");
  const newEmail = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: input.targetUserId } });
  if (!user?.schoolId) throw new UserError("Account not found.");
  const schoolId = user.schoolId;
  const oldEmail = user.email;

  if (oldEmail.toLowerCase() === newEmail.toLowerCase()) throw new UserError("That is already this account's email.");
  const taken = await prisma.user.findFirst({ where: { email: { equals: newEmail, mode: "insensitive" } }, select: { id: true } });
  if (taken) throw new UserError("An account with this email already exists.");

  const now = new Date();
  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { email: newEmail } }),
      // A reset link already sitting in the old inbox must not work any more.
      prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } }),
      prisma.accountEvent.create({
        data: {
          schoolId,
          userId: user.id,
          action: "EMAIL_CHANGED",
          actorUserId: input.actor.userId,
          actorRole: input.actor.role,
          metadata: { from: oldEmail, to: newEmail },
        },
      }),
    ]);
  } catch (err) {
    // Someone took the address between the check above and the write.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new UserError("An account with this email already exists.");
    throw err;
  }

  const token = await createPasswordResetToken(user.id);
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const linkId = await createAndSendNotification({
    schoolId,
    userId: user.id,
    channel: "EMAIL",
    event: "PASSWORD_RESET",
    recipient: newEmail,
    subject: "Your sign-in email has been updated",
    message: `Hi ${user.name},\n\nYour sign-in email on Sophie Educational Assistant is now ${newEmail}, changed by ${input.actor.label}.\n\nSet a new password here (this link expires in 1 hour):\n${baseUrl}/reset-password?token=${token}`,
  });
  await createAndSendNotification({
    schoolId,
    userId: user.id,
    channel: "EMAIL",
    event: "PASSWORD_RESET",
    recipient: oldEmail,
    subject: "Your sign-in email was changed",
    message: `Hi ${user.name},\n\nThe sign-in email for your Sophie Educational Assistant account was changed to ${maskEmail(newEmail)} by ${input.actor.label}.\n\nIf you did not expect this, contact your school administrator straight away.`,
  });

  const link = await prisma.notification.findUnique({ where: { id: linkId }, select: { status: true } });
  return { newEmail, linkSent: link?.status === "SENT" };
}
