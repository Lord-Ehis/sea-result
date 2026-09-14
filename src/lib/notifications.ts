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
}) {
  const notification = await prisma.notification.create({
    data: {
      schoolId: input.schoolId,
      studentId: input.studentId,
      userId: input.userId,
      channel: input.channel,
      event: input.event,
      recipient: input.recipient,
      message: input.message,
      status: "PENDING",
    },
  });

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
