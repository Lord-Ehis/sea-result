import { prisma } from "@/lib/prisma";
import { verifyTransaction, initializeTransaction } from "@/lib/paystack";
import { UserError } from "@/lib/user-error";
import { isTermNumber, termLabel, termNumberFromLabel, type TermNumber } from "@/lib/term-number";
import {
  REGISTRATION_DISCOUNT,
  SESSION_PRICE,
  TERM_PRICE,
  paidWindow,
  quoteSubscription,
  registrationDiscountAvailable,
  sessionOptions,
  type HeldSubscription,
  type Plan,
} from "@/lib/billing-pricing";

type Db = Pick<typeof prisma, "subscription" | "payment">;

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

/** What the school already holds, in the shape the pricing rules read. */
export async function loadHeldSubscriptions(schoolId: string, db: Db = prisma): Promise<HeldSubscription[]> {
  const rows = await db.subscription.findMany({ where: { schoolId } });
  return rows.map((s) => ({
    billingCycle: s.billingCycle,
    termNumber: isTermNumber(s.termNumber) ? s.termNumber : null,
    session: s.session,
    amount: s.amount.toNumber(),
    status: s.status,
    startDate: s.startDate,
    endDate: s.endDate,
    isComplimentary: s.isComplimentary,
  }));
}

/**
 * Prices the plan, records a pending payment and starts the Paystack
 * transaction. Used by Billing and by sign-up (`registering`: the school was
 * just created, so this is its registration payment).
 *
 * A school that registered but never paid keeps that one registration payment:
 * paying again re-uses it (with a fresh Paystack reference), so the new-school
 * price stays tied to it — and disappears for good after any payment succeeds.
 */
export async function beginPayment(input: { schoolId: string; email: string; plan: Plan; session: string; registering?: boolean }) {
  const { schoolId, plan, session } = input;
  const now = new Date();
  const [held, payments] = await Promise.all([
    loadHeldSubscriptions(schoolId),
    prisma.payment.findMany({ where: { schoolId }, select: { id: true, isRegistration: true, status: true } }),
  ]);

  const registration = input.registering === true || registrationDiscountAvailable(payments);
  const quote = quoteSubscription({ plan, session, held, now, registration });
  if (!quote.ok) throw new UserError(quote.reason);

  const reference = `SEA-${schoolId.slice(0, 8)}-${Date.now()}`;
  const intent = {
    amount: quote.amount,
    billingCycle: plan.kind === "SESSION" ? ("FULL_SESSION" as const) : ("PER_TERM" as const),
    termNumber: plan.kind === "TERM" ? plan.termNumber : null,
    session,
    status: "PENDING" as const,
    paystackReference: reference,
  };

  const registrationPayment = registration && !input.registering ? payments.find((p) => p.isRegistration && p.status !== "SUCCESS") : undefined;
  if (registrationPayment) {
    await prisma.payment.update({ where: { id: registrationPayment.id }, data: intent });
  } else {
    await prisma.payment.create({ data: { schoolId, currency: "NGN", isRegistration: registration, ...intent } });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const { authorization_url } = await initializeTransaction({
    email: input.email,
    amountNaira: quote.amount,
    reference,
    // Paystack appends its own ?reference=&trxref= to this URL on redirect —
    // adding our own reference param here would create a duplicate key.
    callbackUrl: `${baseUrl}/admin/billing/callback`,
    metadata: { schoolId, billingCycle: intent.billingCycle, termNumber: intent.termNumber, session },
  });
  return { authorizationUrl: authorization_url };
}

/**
 * Verifies a Paystack transaction and, if successful, marks the Payment
 * SUCCESS and adds the subscription it paid for. Idempotent — safe to call
 * from both the browser callback redirect and the webhook for the same
 * reference (e.g. if the user's callback beats the webhook there).
 *
 * Money has already been taken by the time this runs, so it never refuses:
 * if the term ended while the payment was being made, or the plan was bought
 * twice in parallel, the payment covers the next term instead (see paidWindow).
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

  // What was bought comes from our own record of the payment. Payments started
  // before it was recorded there fall back to what Paystack echoes back.
  const metadata = (verified.metadata ?? {}) as { billingCycle?: "PER_TERM" | "FULL_SESSION"; term?: string; termNumber?: number | null; session?: string };
  const billingCycle = payment.billingCycle ?? metadata.billingCycle ?? "PER_TERM";
  const session = payment.session ?? metadata.session ?? sessionOptions(new Date())[0];
  const termNumber: TermNumber | null =
    billingCycle === "FULL_SESSION" ? null : isTermNumber(payment.termNumber) ? payment.termNumber : isTermNumber(metadata.termNumber) ? metadata.termNumber : termNumberFromLabel(metadata.term);
  const plan: Plan = billingCycle === "FULL_SESSION" ? { kind: "SESSION" } : { kind: "TERM", termNumber: termNumber ?? 1 };
  const amount = payment.amount.toNumber();

  const outcome = await prisma.$transaction(async (tx) => {
    // The first caller to flip the payment to SUCCESS does the work; a
    // simultaneous second caller (webhook + callback) gets nothing back.
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: "SUCCESS" } },
      data: { status: "SUCCESS", paidAt: verified.paid_at ? new Date(verified.paid_at) : new Date() },
    });
    if (claimed.count === 0) return "already" as const;

    const held = await loadHeldSubscriptions(payment.schoolId, tx);
    const now = new Date();
    const window = paidWindow(plan, session, held, now);

    const credit = plan.kind === "SESSION" ? Math.max(0, SESSION_PRICE - amount) : 0;
    const notes: string[] = [];
    if (plan.kind === "TERM" && payment.isRegistration && amount < TERM_PRICE) notes.push(`Registration discount: ${naira(REGISTRATION_DISCOUNT)} off`);
    if (credit > 0) notes.push(`${naira(credit)} credited for terms already paid in ${session}`);

    const subscription = await tx.subscription.create({
      data: {
        schoolId: payment.schoolId,
        billingCycle,
        term: plan.kind === "TERM" ? termLabel(plan.termNumber) : null,
        termNumber: plan.kind === "TERM" ? plan.termNumber : null,
        session,
        amount: payment.amount,
        creditApplied: credit,
        discountNote: notes.length ? notes.join(" · ") : null,
        status: "ACTIVE",
        startDate: window.startDate,
        endDate: window.endDate,
      },
    });
    await tx.payment.update({ where: { id: payment.id }, data: { subscriptionId: subscription.id } });
    return "created" as const;
  });

  return outcome === "already" ? { alreadyProcessed: true as const } : { alreadyProcessed: false as const, success: true as const };
}
