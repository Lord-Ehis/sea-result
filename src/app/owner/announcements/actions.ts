"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";

async function requirePlatformOwner() {
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") throw new Error("Not authorized.");
  return session.user.id;
}

export type AnnouncementSummary = {
  id: string;
  message: string;
  tone: "INFO" | "WARNING";
  linkUrl: string | null;
  linkLabel: string | null;
  isActive: boolean;
  createdAt: string;
};

export async function listAnnouncements(): Promise<AnnouncementSummary[]> {
  await requirePlatformOwner();
  const rows = await prisma.platformAnnouncement.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return rows.map((r) => ({
    id: r.id,
    message: r.message,
    tone: r.tone,
    linkUrl: r.linkUrl,
    linkLabel: r.linkLabel,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  }));
}

// Trimmed before validation, and an empty link/label is stored as null
// rather than an empty string, the same convention as the school profile's
// optional fields.
const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);

const createAnnouncementSchema = z.object({
  message: z.preprocess(trim, z.string().min(1, "Write a message first.").max(500)),
  tone: z.enum(["INFO", "WARNING"]),
  linkUrl: z.preprocess(trim, z.union([z.literal(""), z.string().url("Enter a valid link, e.g. https://...")])),
  linkLabel: z.preprocess(trim, z.string().max(40)),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

// Posts a new banner and ends whatever was live before it, in one
// transaction — only one announcement is ever shown at once, so the old one
// can't keep half-showing after the new one is meant to have replaced it.
export async function createAnnouncement(input: CreateAnnouncementInput): Promise<ActionResult<{ id: string }>> {
  const userId = await requirePlatformOwner();
  return toResult(async () => {
    const parsed = createAnnouncementSchema.parse(input);

    const created = await prisma.$transaction(async (tx) => {
      await tx.platformAnnouncement.updateMany({ where: { isActive: true }, data: { isActive: false } });
      return tx.platformAnnouncement.create({
        data: {
          message: parsed.message,
          tone: parsed.tone,
          linkUrl: parsed.linkUrl || null,
          linkLabel: parsed.linkLabel || null,
          isActive: true,
          createdByUserId: userId,
        },
      });
    });

    revalidatePath("/", "layout");
    revalidatePath("/owner/announcements");
    return { id: created.id };
  });
}

// Ends the live announcement early, without waiting for the next one to
// replace it.
export async function endAnnouncement(id: string): Promise<ActionResult<object>> {
  await requirePlatformOwner();
  return toResult(async () => {
    const updated = await prisma.platformAnnouncement.updateMany({ where: { id, isActive: true }, data: { isActive: false } });
    if (updated.count === 0) throw new UserError("That announcement is no longer live.");

    revalidatePath("/", "layout");
    revalidatePath("/owner/announcements");
    return {};
  });
}
