import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PRICING, validatePricing, type PricingConfig } from "@/lib/billing-pricing";

// The subscription prices the platform owner sets on Global settings. If the
// row is missing (or holds something invalid) the built-in defaults apply, so a
// broken setting can never stop a school from paying.

/** The prices in force now. Read once per request. */
export const getPricing = cache(async (): Promise<PricingConfig> => {
  const row = await prisma.pricingSettings.findUnique({ where: { id: "default" } });
  if (!row) return DEFAULT_PRICING;
  const checked = validatePricing(row);
  return checked.ok ? checked.value : DEFAULT_PRICING;
});

/** Saves new prices and records the change, together. Returns false when nothing changed. */
export async function savePricing(next: PricingConfig, ownerId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.pricingSettings.findUnique({ where: { id: "default" } });
    const checked = row ? validatePricing(row) : null;
    const before: PricingConfig = checked?.ok ? checked.value : DEFAULT_PRICING;
    if (before.termPrice === next.termPrice && before.registrationDiscount === next.registrationDiscount && before.sessionDiscountPercent === next.sessionDiscountPercent) return false;

    await tx.pricingSettings.upsert({
      where: { id: "default" },
      create: { id: "default", ...next, updatedById: ownerId },
      update: { ...next, updatedById: ownerId },
    });
    await tx.pricingChange.create({ data: { changedById: ownerId, before, after: next } });
    return true;
  });
}

/** The latest price changes, newest first, with who made them. */
export async function recentPricingChanges(limit = 5) {
  const changes = await prisma.pricingChange.findMany({ orderBy: { changedAt: "desc" }, take: limit });
  const ownerIds = [...new Set(changes.map((c) => c.changedById).filter((id): id is string => !!id))];
  const owners = ownerIds.length ? await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true } }) : [];
  const nameOf = new Map(owners.map((o) => [o.id, o.name]));
  return changes.map((c) => ({
    id: c.id,
    changedAt: c.changedAt,
    changedBy: (c.changedById && nameOf.get(c.changedById)) || "Platform owner",
    before: c.before as PricingConfig,
    after: c.after as PricingConfig,
  }));
}
