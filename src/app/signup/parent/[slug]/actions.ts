"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  slug: z.string().trim().min(1),
  name: z.string().trim().min(1, "Your name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function registerParent(input: { slug: string; name: string; email: string; password: string }) {
  const parsed = registerSchema.parse(input);

  const school = await prisma.school.findFirst({
    where: { slug: parsed.slug, status: "ACTIVE", allowParentAccounts: true },
  });
  if (!school) throw new Error("Parent accounts aren't available for this school.");

  const existing = await prisma.user.findUnique({ where: { email: parsed.email } });
  if (existing) throw new Error("An account with this email already exists.");

  const passwordHash = await bcrypt.hash(parsed.password, 10);
  await prisma.user.create({
    data: {
      schoolId: school.id,
      role: "PARENT",
      name: parsed.name,
      email: parsed.email,
      passwordHash,
    },
  });
}
