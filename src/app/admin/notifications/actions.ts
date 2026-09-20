"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resendFailedNotification } from "@/lib/notifications";

async function requireSchoolAdmin() {
  const session = await auth();
  if (!session?.user.schoolId || session.user.role !== "SCHOOL_ADMIN") {
    throw new Error("Not authorized.");
  }
  return session.user.schoolId;
}

export type RetryOutcome = { sent: number; failed: number; skipped: number };

// Retries failed result notifications — one row, or every failed one. Safe to
// repeat: each is claimed atomically, so nothing is ever sent twice.
export async function retryNotifications(ids?: string[]): Promise<RetryOutcome> {
  const schoolId = await requireSchoolAdmin();
  const targets = ids?.length
    ? ids
    : (
        await prisma.notification.findMany({
          where: { schoolId, status: "FAILED", event: { in: ["RESULT_PUBLISHED", "RESULT_AMENDED"] } },
          select: { id: true },
          orderBy: { createdAt: "asc" },
          take: 200,
        })
      ).map((n) => n.id);

  const outcome: RetryOutcome = { sent: 0, failed: 0, skipped: 0 };
  for (const id of targets) outcome[await resendFailedNotification(id, schoolId)]++;

  revalidatePath("/admin/notifications");
  return outcome;
}
