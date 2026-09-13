import { redirect } from "next/navigation";
import { completePayment } from "../paymentService";

export default async function BillingCallbackPage({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const { reference } = await searchParams;

  if (!reference) redirect("/admin/billing?payment=missing");

  // redirect() throws internally to interrupt rendering — it must not be
  // called inside the try, or this catch would swallow it as an error.
  let status: "success" | "failed" | "error";
  try {
    const result = await completePayment(reference);
    status = result.success || result.alreadyProcessed ? "success" : "failed";
  } catch {
    status = "error";
  }

  redirect(`/admin/billing?payment=${status}`);
}
