import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/admin-access";
import { getSchoolAccess } from "@/lib/school-access-lookup";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/prisma";
import { quoteGrid, registrationDiscountAvailable, type Quote } from "@/lib/billing-pricing";
import { termLabel, isTermNumber } from "@/lib/term-number";
import { loadHeldSubscriptions } from "./paymentService";
import { BillingClient, type QuoteView } from "./BillingClient";

function quoteView(q: Quote): QuoteView {
  if (!q.ok) return q;
  return {
    ok: true,
    amount: q.amount,
    listPrice: q.listPrice,
    registrationDiscount: q.registrationDiscount,
    credit: q.credit,
    startDate: q.startDate.toISOString(),
    endDate: q.endDate.toISOString(),
  };
}

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

  const now = new Date();
  const [school, subscriptions, payments, held, schoolAccess] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId } }),
    prisma.subscription.findMany({ where: { schoolId, status: { not: "CANCELLED" } }, orderBy: { startDate: "desc" } }),
    prisma.payment.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" } }),
    loadHeldSubscriptions(schoolId),
    getSchoolAccess(schoolId, { fresh: true }),
  ]);

  const registration = registrationDiscountAvailable(payments);
  const grid = quoteGrid({ held, now, registration }).map((g) => ({
    session: g.session,
    plans: g.plans.map((p) => ({ key: p.key, label: p.label, quote: quoteView(p.quote) })),
  }));

  return (
    <BillingClient
      schoolName={school?.name ?? "Your school"}
      access={{
        state: schoolAccess.state,
        coverageEndsAt: schoolAccess.coverageEndsAt?.toISOString() ?? null,
        graceEndsAt: schoolAccess.graceEndsAt?.toISOString() ?? null,
      }}
      subscriptions={subscriptions.map((s) => ({
        id: s.id,
        label: s.isComplimentary ? "Complimentary access" : s.billingCycle === "FULL_SESSION" ? "Full session" : isTermNumber(s.termNumber) ? termLabel(s.termNumber) : (s.term ?? "One term"),
        session: s.session,
        amount: s.amount.toNumber(),
        creditApplied: s.creditApplied.toNumber(),
        discountNote: s.isComplimentary ? null : s.discountNote,
        isComplimentary: s.isComplimentary,
        startDate: s.startDate.toISOString(),
        endDate: s.endDate.toISOString(),
        phase: s.startDate > now ? "UPCOMING" : s.endDate > now ? "CURRENT" : "ENDED",
      }))}
      payments={payments.map((p) => ({
        id: p.id,
        reference: p.paystackReference,
        amount: p.amount.toNumber(),
        status: p.status,
        isRegistration: p.isRegistration,
        createdAt: p.createdAt.toISOString(),
        paidAt: p.paidAt?.toISOString() ?? null,
      }))}
      grid={grid}
      registration={registration}
    />
  );
}
