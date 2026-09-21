import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/admin-access";
import { getSchoolAccess } from "@/lib/school-access-lookup";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/prisma";
import { isNewSubscriber, TERM_PRICE, calculateAmount } from "./paymentService";
import { BillingClient } from "./BillingClient";

export default async function BillingPage() {
  // Billing stays reachable when the subscription has lapsed — it is where a school renews.
  const access = await getAdminAccess(true);
  const { schoolId } = access;
  if (access.campusIds !== null) {
    // A campus admin can't renew; while the school is lapsed they land here, so say who can.
    if ((await getSchoolAccess(schoolId)).state !== "LAPSED") redirect("/admin/dashboard");
    return (
      <PageHeader
        eyebrow="School management"
        title="Subscription ended"
        intro="Your school's subscription has ended. Please ask the school's main administrator to renew it on the Billing page — access returns as soon as they do."
      />
    );
  }
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
