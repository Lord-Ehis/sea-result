"use server";

import { z } from "zod";
import { requireFullAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { initializeTransaction } from "@/lib/paystack";
import { calculateAmount, isNewSubscriber } from "./paymentService";

const initSchema = z.object({
  billingCycle: z.enum(["PER_TERM", "FULL_SESSION"]),
  term: z.string().trim().optional(),
  session: z.string().trim().min(1, "Session is required"),
});

export async function initializeSubscriptionPayment(input: { billingCycle: "PER_TERM" | "FULL_SESSION"; term?: string; session: string }) {
  const { schoolId, userId } = await requireFullAdmin();
  const parsed = initSchema.parse(input);
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });

  const newSubscriber = parsed.billingCycle === "PER_TERM" ? await isNewSubscriber(schoolId) : false;
  const amount = calculateAmount(parsed.billingCycle, newSubscriber);
  const reference = `SEA-${schoolId.slice(0, 8)}-${Date.now()}`;

  await prisma.payment.create({
    data: { schoolId, paystackReference: reference, amount, currency: "NGN", status: "PENDING" },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const { authorization_url } = await initializeTransaction({
    email: admin.email,
    amountNaira: amount,
    reference,
    // Paystack appends its own ?reference=&trxref= to this URL on redirect —
    // adding our own reference param here would create a duplicate key.
    callbackUrl: `${baseUrl}/admin/billing/callback`,
    metadata: { schoolId, billingCycle: parsed.billingCycle, term: parsed.term, session: parsed.session },
  });

  return { authorizationUrl: authorization_url };
}
