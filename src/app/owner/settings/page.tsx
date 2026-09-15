import { PageHeader } from "@/components/ui/PageHeader";
import { getProviderStatus } from "@/lib/provider-settings";
import { SettingsClient } from "./SettingsClient";

export default async function GlobalSettingsPage() {
  const [paystack, termii, resend] = await Promise.all([
    getProviderStatus("PAYSTACK"),
    getProviderStatus("SMS_TERMII"),
    getProviderStatus("EMAIL_RESEND"),
  ]);

  return (
    <>
      <PageHeader eyebrow="Platform overview" title="Global settings" intro="Payment, SMS, and email provider keys used across all schools." />
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
