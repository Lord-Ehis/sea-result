import { TERM_PRICE, calculateAmount } from "@/app/admin/billing/paymentService";
import { SignupWizard } from "./SignupWizard";

export default function SignupPage() {
  return (
    <SignupWizard
      pricing={{
        // Every brand-new signup gets the new-subscriber rate for per-term billing.
        perTermPrice: calculateAmount("PER_TERM", true),
        termPrice: TERM_PRICE,
        sessionPrice: calculateAmount("FULL_SESSION", false),
      }}
    />
  );
}
