import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isNewSubscriber, TERM_PRICE, calculateAmount } from "./paymentService";
import { BillingClient } from "./BillingClient";

export default async function BillingPage() {
  const session = await auth();
  const schoolId = session!.user.schoolId!;
  const school = await prisma.school.findUnique({ where: { id: schoolId } });

  const [subscription, payments, newSubscriber] = await Promise.all([
    prisma.subscription.findFirst({ where: { schoolId }, orderBy: { createdAt: "desc" } }),
    prisma.payment.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" } }),
    isNewSubscriber(schoolId),
  ]);

  return (
    <BillingClient
      schoolName={school?.name ?? "Your school"}
      subscription={
        subscription
          ? {
              billingCycle: subscription.billingCycle,
              term: subscription.term,
              session: subscription.session,
              amount: subscription.amount.toNumber(),
              status: subscription.status,
              startDate: subscription.startDate.toISOString(),
              endDate: subscription.endDate.toISOString(),
              discountNote: subscription.discountNote,
            }
          : null
      }
      payments={payments.map((p) => ({
        id: p.id,
        reference: p.paystackReference,
        amount: p.amount.toNumber(),
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        paidAt: p.paidAt?.toISOString() ?? null,
      }))}
      pricing={{
        termPrice: TERM_PRICE,
        newSubscriberPrice: calculateAmount("PER_TERM", true),
        sessionPrice: calculateAmount("FULL_SESSION", false),
        isNewSubscriber: newSubscriber,
      }}
    />
  );
}
