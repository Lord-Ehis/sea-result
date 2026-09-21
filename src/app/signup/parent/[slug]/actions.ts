"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { LEGAL_VERSION } from "@/lib/legal";
import { callerId, hit, waitMessage } from "@/lib/rate-limit";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";

const registerSchema = z.object({
  slug: z.string().trim().min(1),
  name: z.string().trim().min(1, "Your name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  acceptedTerms: z.boolean().refine((v) => v === true, "Please agree to the Terms of Use and Privacy Policy."),
});

export async function registerParent(input: { slug: string; name: string; email: string; password: string; acceptedTerms: boolean }): Promise<ActionResult> {
  return toResult(async () => {
    const limit = await hit(`parent-signup:${await callerId()}`, 10, 3600);
    if (!limit.allowed) throw new UserError(waitMessage(limit.retryAfterSec));

    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Check the details you entered.");

    const school = await prisma.school.findFirst({
      where: { slug: parsed.data.slug, status: "ACTIVE", allowParentAccounts: true },
    });
    if (!school) throw new UserError("Parent accounts aren't available for this school.");

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) throw new UserError("An account with this email already exists.");

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    await prisma.user.create({
      data: {
        schoolId: school.id,
        role: "PARENT",
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        termsAcceptedAt: new Date(),
        termsVersion: LEGAL_VERSION,
      },
    });
    return {};
  });
}
