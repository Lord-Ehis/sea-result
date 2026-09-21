"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { planFromKey, sessionOptions } from "@/lib/billing-pricing";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";
import { beginPayment } from "@/app/admin/billing/paymentService";

export async function checkSlugAvailable(slug: string) {
  if (!/^[a-z0-9-]{2,}$/.test(slug)) return false;
  const existing = await prisma.school.findUnique({ where: { slug } });
  return !existing;
}

const signupSchema = z.object({
  schoolName: z.string().trim().min(2, "School name is required"),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,}$/, "Use lowercase letters, numbers, and hyphens only"),
  plan: z.string(),
  session: z.string().trim(),
  adminName: z.string().trim().min(1, "Your name is required"),
  adminEmail: z.string().trim().email("Enter a valid email address"),
  adminPassword: z.string().min(8, "Password must be at least 8 characters"),
});

// `plan` is "1", "2", "3" (the term this first payment covers) or "SESSION".
export async function createSchoolSignup(input: {
  schoolName: string;
  slug: string;
  plan: string;
  session: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}): Promise<ActionResult<{ authorizationUrl: string }>> {
  return toResult(async () => {
    const parsed = signupSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Check the details you entered.");
    const plan = planFromKey(parsed.data.plan);
    if (!plan) throw new UserError("Choose a plan.");
    if (!sessionOptions(new Date()).includes(parsed.data.session)) throw new UserError("Choose one of the listed sessions.");

    const [existingSlug, existingEmail] = await Promise.all([
      prisma.school.findUnique({ where: { slug: parsed.data.slug } }),
      prisma.user.findUnique({ where: { email: parsed.data.adminEmail } }),
    ]);
    if (existingSlug) throw new UserError("That URL is already taken. Choose another.");
    if (existingEmail) throw new UserError("An account with this email already exists.");

    const passwordHash = await bcrypt.hash(parsed.data.adminPassword, 10);
    const school = await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: { name: parsed.data.schoolName, slug: parsed.data.slug, status: "ACTIVE" },
      });
      await tx.campus.create({ data: { schoolId: school.id, name: "Main campus" } });
      await tx.user.create({
        data: { schoolId: school.id, role: "SCHOOL_ADMIN", name: parsed.data.adminName, email: parsed.data.adminEmail, passwordHash },
      });
      return school;
    });

    // The payment made here is the school's registration payment: the only one that gets the new-school price.
    return beginPayment({ schoolId: school.id, email: parsed.data.adminEmail, plan, session: parsed.data.session, registering: true });
  });
}
