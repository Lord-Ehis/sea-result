"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumePasswordResetToken } from "@/lib/password-reset";

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function resetPassword(input: { token: string; password: string }) {
  const parsed = resetSchema.parse(input);
  const userId = await consumePasswordResetToken(parsed.token);

  const passwordHash = await bcrypt.hash(parsed.password, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}
