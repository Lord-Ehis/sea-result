export async function sendSms(input: { to: string; message: string }) {
  const apiKey = process.env.SMS_API_KEY;
  if (!apiKey) {
    throw new Error("SMS provider is not configured (SMS_API_KEY missing).");
  }

  // Termii — https://developers.termii.com/messaging (falls back cleanly if
  // Africa's Talking is chosen later: swap the endpoint/body shape here).
  const res = await fetch("https://api.ng.termii.com/api/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      to: input.to,
      from: "SEA",
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
