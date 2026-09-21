import { PageHeader } from "@/components/ui/PageHeader";
import { getProviderStatus } from "@/lib/provider-settings";
import { getPricing, recentPricingChanges } from "@/lib/pricing-settings";
import { PricingSettings } from "./PricingSettings";
import { SettingsClient } from "./SettingsClient";

export default async function GlobalSettingsPage() {
  const [paystack, termii, resend, pricing, changes] = await Promise.all([
    getProviderStatus("PAYSTACK"),
    getProviderStatus("SMS_TERMII"),
    getProviderStatus("EMAIL_RESEND"),
    getPricing(),
    recentPricingChanges(5),
  ]);

  return (
    <>
      <PageHeader eyebrow="Platform overview" title="Global settings" intro="Subscription prices, and the payment, SMS and email provider keys used across all schools." />
      <PricingSettings
        initial={pricing}
        isDefault={changes.length === 0}
        changes={changes.map((c) => ({ id: c.id, changedAt: c.changedAt.toISOString(), changedBy: c.changedBy, before: c.before, after: c.after }))}
      />
      <SettingsClient
        providers={{
          PAYSTACK: { ...paystack, envFallback: !!process.env.PAYSTACK_SECRET_KEY },
          SMS_TERMII: { ...termii, envFallback: !!(process.env.SMS_API_KEY && process.env.SMS_BASE_URL) },
          EMAIL_RESEND: { ...resend, envFallback: !!(process.env.EMAIL_API_KEY && process.env.EMAIL_FROM) },
        }}
      />
    </>
  );
}
