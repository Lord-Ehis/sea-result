import crypto from "crypto";
import { getProviderConfig } from "@/lib/provider-settings";
import { paystackKeyMode } from "@/lib/readiness-rules";

const PAYSTACK_BASE = "https://api.paystack.co";

type PaystackConfig = { secretKey: string; publicKey?: string };

async function getConfig(): Promise<PaystackConfig> {
  const dbConfig = await getProviderConfig<PaystackConfig>("PAYSTACK");
  if (dbConfig?.secretKey) return dbConfig;

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  return { secretKey, publicKey: process.env.PAYSTACK_PUBLIC_KEY };
}

/** Whether Paystack is in test or live mode, from the key's prefix. The key itself never leaves this file. */
export async function getPaystackKeyMode() {
  try {
    const { secretKey } = await getConfig();
    return paystackKeyMode(secretKey);
  } catch {
    return paystackKeyMode(null);
  }
}

type InitializeResponse = {
  status: boolean;
  message: string;
  data?: { authorization_url: string; access_code: string; reference: string };
};

export async function initializeTransaction(input: {
  email: string;
  amountNaira: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}) {
  const { secretKey } = await getConfig();
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amountNaira * 100), // kobo
      reference: input.reference,
      callback_url: input.callbackUrl,
      currency: "NGN",
      metadata: input.metadata,
    }),
  });

  const json = (await res.json()) as InitializeResponse;
  if (!res.ok || !json.status || !json.data) {
    throw new Error(json.message || "Could not start the Paystack transaction.");
  }
  return json.data;
}

type VerifyResponse = {
  status: boolean;
  message: string;
  data?: {
    status: "success" | "failed" | "abandoned";
    reference: string;
    amount: number;
    currency: string;
    paid_at: string | null;
    metadata: Record<string, unknown>;
  };
};

export async function verifyTransaction(reference: string) {
  const { secretKey } = await getConfig();
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: "no-store",
  });
  const json = (await res.json()) as VerifyResponse;
  if (!res.ok || !json.status || !json.data) {
    throw new Error(json.message || "Could not verify the Paystack transaction.");
  }
  return json.data;
}

export async function verifyWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const { secretKey } = await getConfig();
  const hash = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  return hash === signature;
}
