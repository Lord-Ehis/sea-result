"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendEmail } from "@/lib/email";

const emailSchema = z.string().trim().email();

/**
 * Always resolves the same way regardless of whether the email matches an
 * account — the UI shows one generic message either way, so this never
 * reveals whether an email is registered.
 */
export async function requestPasswordReset(rawEmail: string) {
  const email = emailSchema.parse(rawEmail);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const token = await createPasswordResetToken(user.id);
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/reset-password?token=${token}`;

  try {
    await sendEmail({
      to: email,
      subject: "Reset your Sophie Educational Assistant password",
      text: `Hi ${user.name},\n\nWe received a request to reset your password. This link expires in 1 hour:\n${link}\n\nIf you didn't request this, you can ignore this email.`,
    });
  } catch {
    // Swallowed deliberately — the caller shows the same generic message
    // whether or not the account exists, so a send failure can't leak that.
  }
}
