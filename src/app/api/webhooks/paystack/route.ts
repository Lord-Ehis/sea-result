import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { completePayment } from "@/app/admin/billing/paymentService";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!(await verifyWebhookSignature(rawBody, signature))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as { event: string; data?: { reference?: string } };

  if (event.event === "charge.success" && event.data?.reference) {
    try {
      await completePayment(event.data.reference);
    } catch {
      // Swallow — Paystack retries webhooks on non-2xx, and a failure here
      // (e.g. unknown reference) isn't something a retry would fix.
    }
  }

  return NextResponse.json({ received: true });
}
