import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";
import type { NotificationChannel, NotificationEvent } from "@prisma/client";

/**
 * Creates a Notification row and attempts to send it immediately (no
 * background queue at this scale — a publish batch is a few dozen
 * students at most, triggered interactively). Failures are recorded on
 * the row rather than thrown, so one bad recipient doesn't block the
 * rest of a batch.
 *
 * With a `dedupeKey` the call is idempotent: repeating it never messages the
 * same person twice. An existing SENT/PENDING notification is left alone; an
 * existing FAILED one is retried on the same row.
 */
export async function createAndSendNotification(input: {
  schoolId: string;
  studentId?: string;
  userId?: string;
  channel: NotificationChannel;
  event: NotificationEvent;
  recipient: string;
  message: string;
  subject?: string;
  dedupeKey?: string;
}) {
  let notification = input.dedupeKey ? await prisma.notification.findUnique({ where: { dedupeKey: input.dedupeKey } }) : null;
  if (notification && notification.status !== "FAILED") return notification.id;

  if (!notification) {
    try {
      notification = await prisma.notification.create({
        data: {
          schoolId: input.schoolId,
          studentId: input.studentId,
          userId: input.userId,
          channel: input.channel,
          event: input.event,
          recipient: input.recipient,
          message: input.message,
          status: "PENDING",
          dedupeKey: input.dedupeKey,
        },
      });
    } catch (err) {
      // A concurrent publish created it first — that one owns the send.
      if (input.dedupeKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existing = await prisma.notification.findUnique({ where: { dedupeKey: input.dedupeKey } });
        if (existing) return existing.id;
      }
      throw err;
    }
  } else {
    notification = await prisma.notification.update({ where: { id: notification.id }, data: { status: "PENDING" } });
  }

  await deliver(notification.id, input.channel, input.recipient, input.message, input.subject);
  return notification.id;
}

async function deliver(id: string, channel: NotificationChannel, recipient: string, message: string, subject?: string) {
  try {
    if (channel === "SMS") {
      await sendSms({ to: recipient, message });
    } else {
      await sendEmail({ to: recipient, subject: subject ?? "A message from your school", text: message });
    }
    await prisma.notification.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
    return "sent" as const;
  } catch {
    await prisma.notification.update({ where: { id }, data: { status: "FAILED" } });
    return "failed" as const;
  }
}

const RETRY_SUBJECT: Partial<Record<NotificationEvent, string>> = {
  RESULT_PUBLISHED: "Your child's result has been published",
  RESULT_AMENDED: "A corrected result is available",
};

/**
 * Re-sends one notification that failed. Claiming FAILED → PENDING in a
 * single update means two people clicking Retry (or a double click) can't
 * send it twice. Only result notifications are retried — anything else
 * (password resets, say) carries a link that has since expired.
 */
export async function resendFailedNotification(id: string, schoolId: string): Promise<"sent" | "failed" | "skipped"> {
  const row = await prisma.notification.findFirst({ where: { id, schoolId, status: "FAILED" } });
  if (!row || !RETRY_SUBJECT[row.event]) return "skipped";
  const claimed = await prisma.notification.updateMany({ where: { id, schoolId, status: "FAILED" }, data: { status: "PENDING" } });
  if (claimed.count === 0) return "skipped";
  return deliver(row.id, row.channel, row.recipient, row.message, RETRY_SUBJECT[row.event]);
}

/** Runs the tasks with at most `limit` in flight — a class's worth of sends without opening a hundred connections at once. */
export async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const task = tasks[next++];
      try {
        await task();
      } catch {
        // createAndSendNotification records its own failures; one bad recipient must not stop the rest.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}
