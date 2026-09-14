"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requirePlatformOwner() {
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") throw new Error("Not authorized.");
}

export async function setSchoolStatus(schoolId: string, status: "ACTIVE" | "SUSPENDED") {
  await requirePlatformOwner();
  await prisma.school.update({ where: { id: schoolId }, data: { status } });
  revalidatePath("/owner/schools");
  revalidatePath(`/owner/schools/${schoolId}`);
}
