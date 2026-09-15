import { prisma } from "@/lib/prisma";
import { decryptJson, encryptJson } from "@/lib/crypto";
import type { ProviderKind } from "@prisma/client";

/**
 * DB-stored provider config overrides the environment default when present
 * and active. Decrypt failures (e.g. PROVIDER_CONFIG_KEY rotated) fall back
 * to the environment rather than breaking sends.
 */
export async function getProviderConfig<T>(provider: ProviderKind): Promise<T | null> {
  const row = await prisma.providerSetting.findUnique({ where: { provider } });
  if (!row || !row.isActive) return null;
  try {
    return decryptJson<T>(row.config as string);
  } catch {
    return null;
  }
}

export async function setProviderConfig(provider: ProviderKind, config: Record<string, string>) {
  await prisma.providerSetting.upsert({
    where: { provider },
    update: { config: encryptJson(config), isActive: true },
    create: { provider, config: encryptJson(config), isActive: true },
  });
}

export async function clearProviderConfig(provider: ProviderKind) {
  await prisma.providerSetting.deleteMany({ where: { provider } });
}

export async function getProviderStatus(provider: ProviderKind) {
  const row = await prisma.providerSetting.findUnique({ where: { provider } });
  return { configured: !!row?.isActive, updatedAt: row?.updatedAt.toISOString() ?? null };
}
