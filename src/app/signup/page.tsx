import { REGISTRATION_DISCOUNT, SESSION_PRICE, TERM_PRICE, sessionOptions } from "@/lib/billing-pricing";
import { currentTermNumber } from "@/lib/academic-term";
import { SignupWizard } from "./SignupWizard";

export default function SignupPage() {
  const now = new Date();
  return (
    <SignupWizard
      pricing={{
        // The first payment gets the new-school rate for a term; a full session has its own 20% saving.
        perTermPrice: TERM_PRICE - REGISTRATION_DISCOUNT,
        termPrice: TERM_PRICE,
        sessionPrice: SESSION_PRICE,
      }}
      sessions={sessionOptions(now)}
      defaultTerm={currentTermNumber(now)}
    />
  );
}
