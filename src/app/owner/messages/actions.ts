"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";
import { resendFailedNotification, runWithConcurrency } from "@/lib/notifications";
import { hit, waitMessage } from "@/lib/rate-limit";
import { FAILED_MESSAGE_DAYS } from "@/lib/owner-attention";
import { RETRYABLE_EVENTS, RETRY_BATCH_LIMIT, explainProviderError, parseTestTarget, type MessageChannel } from "@/lib/owner-messages";
import { toResult, type ActionResult } from "@/lib/user-error";

async function requirePlatformOwner() {
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") throw new Error("Not authorized.");
  return session.user.id;
}

export type RetryOutcome = { sent: number; failed: number; skipped: number; moreLeft: boolean };

/**
 * Re-sends failed result notifications from the last two weeks: one school's, or
 * everyone's. Each one is claimed atomically, so a double click or two people
 * retrying never sends a message twice. At most RETRY_BATCH_LIMIT per click.
 */
export async function retryFailedMessages(input: { schoolId?: string } = {}): Promise<ActionResult<RetryOutcome>> {
  await requirePlatformOwner();
  return toResult(async () => {
    const since = new Date(Date.now() - FAILED_MESSAGE_DAYS * 86_400_000);
    const rows = await prisma.notification.findMany({
      where: { status: "FAILED", event: { in: [...RETRYABLE_EVENTS] }, createdAt: { gte: since }, ...(input.schoolId ? { schoolId: input.schoolId } : {}) },
      orderBy: { createdAt: "asc" },
      take: RETRY_BATCH_LIMIT + 1,
      select: { id: true, schoolId: true },
    });
    const targets = rows.slice(0, RETRY_BATCH_LIMIT);

    const outcome: RetryOutcome = { sent: 0, failed: 0, skipped: 0, moreLeft: rows.length > RETRY_BATCH_LIMIT };
    await runWithConcurrency(
      targets.map((t) => async () => {
        outcome[await resendFailedNotification(t.id, t.schoolId)]++;
      }),
      5,
    );

    revalidatePath("/owner/messages");
    revalidatePath("/owner/dashboard");
    return outcome;
  });
}

export type TestMessageResult = { ok: true } | { ok: false; error: string; hint: string | null };

/**
 * Sends one real test message through the provider and reports exactly what
 * came back. Failed messages don't record why they failed, so this is how to
 * find out. Limited to 10 a hour so it can't be used to spam an inbox.
 */
export async function sendTestMessage(input: { channel: MessageChannel; to: string }): Promise<TestMessageResult> {
  const ownerId = await requirePlatformOwner();

  const limit = await hit(`owner-test-message:${ownerId}`, 10, 3600);
  if (!limit.allowed) return { ok: false, error: waitMessage(limit.retryAfterSec), hint: null };

  const channel: MessageChannel = input.channel === "SMS" ? "SMS" : "EMAIL";
  const target = parseTestTarget(channel, input.to);
  if (!target.ok) return { ok: false, error: target.error, hint: null };

  try {
    if (channel === "EMAIL") {
      await sendEmail({ to: target.value, subject: "Test message from Sophie Educational Assistant", text: "This is a test message sent from the platform owner's Messages page. If you can read this, email delivery is working." });
    } else {
      await sendSms({ to: target.value, message: "Sophie Educational Assistant: this is a test message. If you can read it, SMS delivery is working." });
    }
    return { ok: true };
  } catch (err) {
    const message = (err instanceof Error ? err.message : "The provider did not answer.").slice(0, 400);
    return { ok: false, error: message, hint: explainProviderError(message) };
  }
}
