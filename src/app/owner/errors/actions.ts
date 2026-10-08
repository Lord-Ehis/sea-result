"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requirePlatformOwner() {
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") throw new Error("Not authorized.");
}

/** Marks one error as dealt with. If it happens again it comes back and the owner is emailed again. */
export async function resolveError(id: string) {
  await requirePlatformOwner();
  await prisma.errorEvent.updateMany({ where: { id, resolvedAt: null }, data: { resolvedAt: new Date() } });
  revalidatePath("/owner/errors");
  revalidatePath("/owner/dashboard");
}

export async function resolveAllErrors() {
  await requirePlatformOwner();
  await prisma.errorEvent.updateMany({ where: { resolvedAt: null }, data: { resolvedAt: new Date() } });
  revalidatePath("/owner/errors");
  revalidatePath("/owner/dashboard");
}
