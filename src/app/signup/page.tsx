import { startingOffer } from "@/lib/billing-pricing";
import { SignupWizard, type SignupOffer } from "./SignupWizard";

export default function SignupPage() {
  // What a school registering today can start with, priced by the same rules Billing uses.
  const o = startingOffer(new Date());
  const offer: SignupOffer = {
    term:
      o.term && o.term.quote.ok
        ? {
            key: o.term.key,
            label: o.term.label,
            session: o.term.session,
            listPrice: o.term.quote.listPrice,
            discount: o.term.quote.registrationDiscount,
            amount: o.term.quote.amount,
            start: o.term.quote.startDate.toISOString(),
            end: o.term.quote.endDate.toISOString(),
          }
        : null,
    session:
      o.session && o.session.quote.ok
        ? {
            session: o.session.session,
            listPrice: o.session.quote.listPrice,
            amount: o.session.quote.amount,
            start: o.session.quote.startDate.toISOString(),
            end: o.session.quote.endDate.toISOString(),
          }
        : null,
  };
  return <SignupWizard offer={offer} />;
}
