import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function BillingPage() {
  return (
    <>
      <PageHeader eyebrow="School workspace" title="Billing & subscription" intro="Your plan, payment history, and renewal date." />
      <EmptyState icon={CreditCard} title="No subscription yet" description="Subscribe to a term or full session to unlock results and notifications." />
    </>
  );
}
