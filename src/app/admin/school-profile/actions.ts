"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFullAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

// School-wide branding shown on printed results and (later) other public
// pages. A campus admin is refused (see src/lib/admin-access.ts).

const profileSchema = z.object({
  logoUrl: z.string().trim().url("Enter a valid image URL, e.g. https://...").max(2048).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  supportEmail: z.string().trim().toLowerCase().email("Enter a valid email address").max(255).optional().or(z.literal("")),
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
