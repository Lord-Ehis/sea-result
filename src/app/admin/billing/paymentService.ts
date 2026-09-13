import { prisma } from "@/lib/prisma";
import { verifyTransaction } from "@/lib/paystack";

export const TERM_PRICE = 50000;
export const SESSION_DISCOUNT_RATE = 0.2;
export const NEW_SUBSCRIBER_DISCOUNT = 10000;

export async function isNewSubscriber(schoolId: string) {
  const count = await prisma.payment.count({ where: { schoolId, status: "SUCCESS" } });
  return count === 0;
}

export function calculateAmount(billingCycle: "PER_TERM" | "FULL_SESSION", newSubscriber: boolean) {
  if (billingCycle === "FULL_SESSION") {
    return Math.round(TERM_PRICE * 3 * (1 - SESSION_DISCOUNT_RATE));
  }
  return newSubscriber ? TERM_PRICE - NEW_SUBSCRIBER_DISCOUNT : TERM_PRICE;
}

/**
 * Verifies a Paystack transaction and, if successful, marks the Payment
 * SUCCESS and activates a Subscription. Idempotent — safe to call from
 * both the browser callback redirect and the webhook for the same
 * reference (e.g. if the user's callback beats the webhook there).
 */
export async function completePayment(reference: string) {
  const payment = await prisma.payment.findUnique({ where: { paystackReference: reference } });
  if (!payment) throw new Error("Payment record not found.");
  if (payment.status === "SUCCESS") return { alreadyProcessed: true as const };

  const verified = await verifyTransaction(reference);
  if (verified.reference !== reference) throw new Error("Reference mismatch.");

  if (verified.status !== "success") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    return { alreadyProcessed: false as const, success: false as const };
  }

  const metadata = verified.metadata as { billingCycle?: "PER_TERM" | "FULL_SESSION"; term?: string; session?: string };
  const billingCycle = metadata.billingCycle ?? "PER_TERM";
  const session = metadata.session ?? new Date().getFullYear().toString();
  const term = billingCycle === "PER_TERM" ? (metadata.term ?? null) : null;

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + (billingCycle === "FULL_SESSION" ? 12 : 4));

  await prisma.$transaction(async (tx) => {
    await tx.subscription.updateMany({
      where: { schoolId: payment.schoolId, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });

    const subscription = await tx.subscription.create({
      data: {
        schoolId: payment.schoolId,
        billingCycle,
        term,
        session,
        amount: payment.amount,
        discountNote: metadata.billingCycle === "PER_TERM" && payment.amount.lt(TERM_PRICE) ? "New subscriber discount applied" : null,
        status: "ACTIVE",
        startDate,
        endDate,
      },
    });

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCESS", paidAt: verified.paid_at ? new Date(verified.paid_at) : new Date(), subscriptionId: subscription.id },
    });
  });

  return { alreadyProcessed: false as const, success: true as const };
}
