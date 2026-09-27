"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFullAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import { ImageError, validateImage } from "@/lib/image-validate";
import { StorageNotConfigured, putPublicImage } from "@/lib/storage";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";

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
  principalName: z.preprocess(trim, z.string().max(120)),
  principalSignatureUrl: z.preprocess(trim, z.union([z.literal(""), z.string().url("Enter a valid image URL, e.g. https://...").max(2048)])),
  stampUrl: z.preprocess(trim, z.union([z.literal(""), z.string().url("Enter a valid image URL, e.g. https://...").max(2048)])),
  nextTermBegins: z.preprocess(trim, z.union([z.literal(""), z.iso.date("Enter a valid date")])),
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
      principalName: parsed.principalName || null,
      principalSignatureUrl: parsed.principalSignatureUrl || null,
      stampUrl: parsed.stampUrl || null,
      nextTermBegins: parsed.nextTermBegins ? new Date(parsed.nextTermBegins) : null,
    },
  });

  revalidatePath("/admin/school-profile");
}

const IMAGE_KINDS = ["logo", "signature", "stamp"] as const;

// Stores an uploaded logo / signature / stamp and hands back its public URL
// for the form to fill in (the admin still presses Save, like any other
// field). Checked on the server by the file's real bytes and size, and stored
// under a fresh unique name every time — a published result keeps pointing at
// the exact file it was printed with even if the school uploads a new one.
export async function uploadSchoolImage(formData: FormData): Promise<ActionResult<{ url: string }>> {
  const { schoolId } = await requireFullAdmin();
  return toResult(async () => {
    const kind = formData.get("kind");
    const file = formData.get("file");
    if (typeof kind !== "string" || !(IMAGE_KINDS as readonly string[]).includes(kind)) throw new UserError("Unknown image type.");
    if (!(file instanceof File)) throw new UserError("Choose an image to upload.");

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const type = validateImage(bytes);
      const url = await putPublicImage(`${schoolId}/${kind}-${randomUUID()}.${type}`, bytes, type);
      return { url };
    } catch (err) {
      if (err instanceof ImageError || err instanceof StorageNotConfigured) throw new UserError(err.message);
      throw err;
    }
  });
}
