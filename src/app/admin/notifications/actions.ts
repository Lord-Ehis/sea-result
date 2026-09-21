"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin-access";
import { ofStudentWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { resendFailedNotification } from "@/lib/notifications";


export type RetryOutcome = { sent: number; failed: number; skipped: number };

// Retries failed result notifications — one row, or every failed one. Safe to
// repeat: each is claimed atomically, so nothing is ever sent twice.
export async function retryNotifications(ids?: string[]): Promise<RetryOutcome> {
  const access = await getAdminAccess();
  const { schoolId } = access;
  // Ids from the browser are only honoured if they are this admin's own.
  const allowedIds = ids?.length
    ? (await prisma.notification.findMany({ where: { id: { in: ids }, schoolId, ...ofStudentWhere(access) }, select: { id: true } })).map((n) => n.id)
    : null;
  const targets = allowedIds
    ? allowedIds
    : (
        await prisma.notification.findMany({
          where: { schoolId, ...ofStudentWhere(access), status: "FAILED", event: { in: ["RESULT_PUBLISHED", "RESULT_AMENDED"] } },
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
