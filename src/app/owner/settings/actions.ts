"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { setProviderConfig, clearProviderConfig } from "@/lib/provider-settings";
import { validatePricing } from "@/lib/billing-pricing";
import { savePricing } from "@/lib/pricing-settings";
import { UserError, toResult, type ActionResult } from "@/lib/user-error";
import type { ProviderKind } from "@prisma/client";

async function requirePlatformOwner() {
  const session = await auth();
  if (session?.user.role !== "PLATFORM_OWNER") throw new Error("Not authorized.");
  return session.user.id;
}

const paystackSchema = z.object({
  secretKey: z.string().trim().min(1, "Secret key is required"),
  publicKey: z.string().trim().optional(),
});

const termiiSchema = z.object({
  apiKey: z.string().trim().min(1, "API key is required"),
  baseUrl: z.string().trim().url("Enter a valid URL"),
  senderId: z.string().trim().min(3, "Sender ID must be 3-11 characters").max(11, "Sender ID must be 3-11 characters"),
});

const resendSchema = z.object({
  apiKey: z.string().trim().min(1, "API key is required"),
  from: z.string().trim().email("Enter a valid sender email address"),
});

export async function savePaystackConfig(input: { secretKey: string; publicKey?: string }) {
  await requirePlatformOwner();
  const parsed = paystackSchema.parse(input);
  await setProviderConfig("PAYSTACK", parsed);
  revalidatePath("/owner/settings");
}

export async function saveTermiiConfig(input: { apiKey: string; baseUrl: string; senderId: string }) {
  await requirePlatformOwner();
  const parsed = termiiSchema.parse(input);
  await setProviderConfig("SMS_TERMII", parsed);
  revalidatePath("/owner/settings");
}

export async function saveResendConfig(input: { apiKey: string; from: string }) {
  await requirePlatformOwner();
  const parsed = resendSchema.parse(input);
  await setProviderConfig("EMAIL_RESEND", parsed);
  revalidatePath("/owner/settings");
}

export async function clearProvider(provider: ProviderKind) {
  await requirePlatformOwner();
  await clearProviderConfig(provider);
  revalidatePath("/owner/settings");
}

// The subscription prices every school pays. Applies to new payments from the
// moment it is saved; each change is logged with who made it.
export async function updatePricing(input: { termPrice: number; registrationDiscount: number; sessionDiscountPercent: number }): Promise<ActionResult<{ changed: boolean }>> {
  const ownerId = await requirePlatformOwner();
  return toResult(async () => {
    const checked = validatePricing(input);
    if (!checked.ok) throw new UserError(checked.error);
    const changed = await savePricing(checked.value, ownerId);
    revalidatePath("/owner/settings");
    revalidatePath("/admin/billing");
    revalidatePath("/signup");
    return { changed };
  });
}
