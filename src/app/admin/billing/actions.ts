"use server";

import { z } from "zod";
import { requireFullAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { planFromKey } from "@/lib/billing-pricing";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";
import { beginPayment } from "./paymentService";

const initSchema = z.object({
  plan: z.string(),
  session: z.string().trim().min(1, "Choose a session"),
});

// `plan` is "1", "2", "3" (that term) or "SESSION". The price and dates are
// worked out here from what the school already holds — never taken from the browser.
export async function initializeSubscriptionPayment(input: { plan: string; session: string }): Promise<ActionResult<{ authorizationUrl: string }>> {
  const { schoolId, userId } = await requireFullAdmin(true);
  return toResult(async () => {
    const parsed = initSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Choose a plan.");
    const plan = planFromKey(parsed.data.plan);
    if (!plan) throw new UserError("Choose a plan.");

    const admin = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    return beginPayment({ schoolId, email: admin.email, plan, session: parsed.data.session });
  });
}
