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

  try {
    if (input.channel === "SMS") {
      await sendSms({ to: input.recipient, message: input.message });
    } else {
      await sendEmail({ to: input.recipient, subject: input.subject ?? "A message from your school", text: input.message });
    }
    await prisma.notification.update({ where: { id: notification.id }, data: { status: "SENT", sentAt: new Date() } });
  } catch {
    await prisma.notification.update({ where: { id: notification.id }, data: { status: "FAILED" } });
  }

  return notification.id;
}
