import { getProviderConfig } from "@/lib/provider-settings";

type TermiiConfig = { apiKey: string; baseUrl: string; senderId: string };

async function getConfig(): Promise<TermiiConfig> {
  const dbConfig = await getProviderConfig<TermiiConfig>("SMS_TERMII");
  if (dbConfig?.apiKey && dbConfig?.baseUrl) return dbConfig;

  const apiKey = process.env.SMS_API_KEY;
  const baseUrl = process.env.SMS_BASE_URL;
  if (!apiKey || !baseUrl) {
    throw new Error("SMS provider is not configured (SMS_API_KEY/SMS_BASE_URL missing).");
  }
  return { apiKey, baseUrl, senderId: "SEA" };
}

export async function sendSms(input: { to: string; message: string }) {
  const { apiKey, baseUrl, senderId } = await getConfig();

  // Termii — https://developers.termii.com/messaging-api (falls back cleanly
  // if Africa's Talking is chosen later: swap the endpoint/body shape here).
  const res = await fetch(new URL("/api/sms/send", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      to: input.to,
      from: senderId,
      sms: input.message,
      type: "plain",
      channel: "generic",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Termii request failed (${res.status}): ${body}`);
  }
}
