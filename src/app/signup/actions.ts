"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { initializeTransaction } from "@/lib/paystack";
import { calculateAmount } from "@/app/admin/billing/paymentService";

export async function checkSlugAvailable(slug: string) {
  if (!/^[a-z0-9-]{2,}$/.test(slug)) return false;
  const existing = await prisma.school.findUnique({ where: { slug } });
  return !existing;
}

const signupSchema = z.object({
  schoolName: z.string().trim().min(2, "School name is required"),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,}$/, "Use lowercase letters, numbers, and hyphens only"),
  billingCycle: z.enum(["PER_TERM", "FULL_SESSION"]),
  term: z.string().trim().optional(),
  session: z.string().trim().min(1, "Academic session is required"),
  adminName: z.string().trim().min(1, "Your name is required"),
  adminEmail: z.string().trim().email("Enter a valid email address"),
  adminPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function createSchoolSignup(input: {
  schoolName: string;
  slug: string;
  billingCycle: "PER_TERM" | "FULL_SESSION";
  term?: string;
  session: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}) {
  const parsed = signupSchema.parse(input);

  const [existingSlug, existingEmail] = await Promise.all([
    prisma.school.findUnique({ where: { slug: parsed.slug } }),
    prisma.user.findUnique({ where: { email: parsed.adminEmail } }),
  ]);
  if (existingSlug) throw new Error("That URL is already taken. Choose another.");
  if (existingEmail) throw new Error("An account with this email already exists.");

  const passwordHash = await bcrypt.hash(parsed.adminPassword, 10);
  // Every brand-new school qualifies for the new-subscriber rate.
  const amount = calculateAmount(parsed.billingCycle, true);

  const school = await prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: { name: parsed.schoolName, slug: parsed.slug, status: "ACTIVE" },
    });
    await tx.campus.create({ data: { schoolId: school.id, name: "Main campus" } });
    await tx.user.create({
      data: { schoolId: school.id, role: "SCHOOL_ADMIN", name: parsed.adminName, email: parsed.adminEmail, passwordHash },
    });
    return school;
  });

  const reference = `SEA-${school.id.slice(0, 8)}-${Date.now()}`;
  await prisma.payment.create({
    data: { schoolId: school.id, paystackReference: reference, amount, currency: "NGN", status: "PENDING" },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const { authorization_url } = await initializeTransaction({
    email: parsed.adminEmail,
    amountNaira: amount,
    reference,
    // Reuses the existing billing callback — it just verifies a reference
    // and doesn't care whether the school is brand new or established.
    callbackUrl: `${baseUrl}/admin/billing/callback`,
    metadata: { schoolId: school.id, billingCycle: parsed.billingCycle, term: parsed.term, session: parsed.session },
  });

  return { authorizationUrl: authorization_url };
}
