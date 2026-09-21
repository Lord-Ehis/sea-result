import { getProviderConfig } from "@/lib/provider-settings";

type ResendConfig = { apiKey: string; from: string };

async function getConfig(): Promise<ResendConfig> {
  const dbConfig = await getProviderConfig<ResendConfig>("EMAIL_RESEND");
  if (dbConfig?.apiKey && dbConfig?.from) return dbConfig;

  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("Email provider is not configured (EMAIL_API_KEY/EMAIL_FROM missing).");
  }
  return { apiKey, from };
}

/** The email settings in use, or null when none are set. Used by the Go-live checks. */
export async function readEmailConfig(): Promise<ResendConfig | null> {
  try {
    return await getConfig();
  } catch {
    return null;
  }
}

export async function sendEmail(input: { to: string; subject: string; text: string }) {
  const { apiKey, from } = await getConfig();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend request failed (${res.status}): ${body}`);
  }
}
