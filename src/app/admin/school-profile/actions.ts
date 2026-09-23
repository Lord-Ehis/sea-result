"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFullAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

// School-wide branding shown on printed results and (later) other public
// pages. A campus admin is refused (see src/lib/admin-access.ts).

// Trimmed before validation, so a stray space left behind while clearing a
// field is treated as empty rather than rejected as an invalid URL/email.
const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);

const profileSchema = z.object({
  logoUrl: z.preprocess(trim, z.union([z.literal(""), z.string().url("Enter a valid image URL, e.g. https://...").max(2048)])),
  address: z.preprocess(trim, z.string().max(300)),
  phone: z.preprocess(trim, z.string().max(50)),
  supportEmail: z.preprocess(trim, z.union([z.literal(""), z.string().toLowerCase().email("Enter a valid email address").max(255)])),
});

export type SchoolProfileInput = z.infer<typeof profileSchema>;

export async function updateSchoolProfile(input: SchoolProfileInput) {
  const { schoolId } = await requireFullAdmin();
  const parsed = profileSchema.parse(input);

  await prisma.school.update({
    where: { id: schoolId },
    data: {
      logoUrl: parsed.logoUrl || null,
      address: parsed.address || null,
      phone: parsed.phone || null,
      supportEmail: parsed.supportEmail || null,
    },
  });

  revalidatePath("/admin/school-profile");
}
