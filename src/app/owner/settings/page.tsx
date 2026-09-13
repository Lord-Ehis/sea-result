import { Settings } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function GlobalSettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Platform overview"
        title="Global settings"
        intro="Payment, SMS, and email provider keys used across all schools."
      />
      <EmptyState icon={Settings} title="No providers configured" description="Add Paystack, SMS, and email provider keys to enable billing and notifications." />
    </>
  );
}
