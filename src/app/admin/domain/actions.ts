"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDomainToProject, removeDomainFromProject, getDomainConfig } from "@/lib/vercel";

/**
 * Vercel's `verified` field from the add-domain call means "ownership
 * verified within Vercel" (trivially true for a domain nobody else has
 * claimed) — NOT "DNS actually points here." Whether the domain is
 * genuinely live is the `misconfigured` flag from the domain config
 * endpoint, which is what we treat as ground truth for our UI.
 */
async function isDomainLive(domain: string) {
  try {
    const cfg = await getDomainConfig(domain);
    return !cfg.misconfigured;
  } catch {
    return false;
  }
}

async function requireSchoolAdmin() {
  const session = await auth();
  if (!session?.user.schoolId || session.user.role !== "SCHOOL_ADMIN") {
    throw new Error("Not authorized.");
  }
  return session.user.schoolId;
}

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?!-)[a-z0-9-]+(?:\.(?!-)[a-z0-9-]+){2,}$/, "Enter a valid subdomain, e.g. results.yourschool.com");

export async function addCustomDomain(rawDomain: string) {
  const schoolId = await requireSchoolAdmin();
  const domain = domainSchema.parse(rawDomain);

  const existing = await prisma.school.findUnique({ where: { customDomain: domain } });
  if (existing && existing.id !== schoolId) {
    throw new Error("This domain is already connected to another school.");
  }

  const result = await addDomainToProject(domain);
  if (!result.verified) {
    throw new Error("This domain needs an extra ownership check — it may already be claimed elsewhere on Vercel.");
  }

  const live = await isDomainLive(domain);

  await prisma.school.update({
    where: { id: schoolId },
    data: { customDomain: domain, customDomainVerified: live },
  });

  revalidatePath("/admin/domain");
}

export async function checkCustomDomainStatus() {
  const schoolId = await requireSchoolAdmin();
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school?.customDomain) throw new Error("No domain connected.");

  const live = await isDomainLive(school.customDomain);

  await prisma.school.update({ where: { id: schoolId }, data: { customDomainVerified: live } });
  revalidatePath("/admin/domain");
  return live;
}

export async function removeCustomDomain() {
  const schoolId = await requireSchoolAdmin();
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school?.customDomain) return;

  try {
    await removeDomainFromProject(school.customDomain);
  } catch {
    // Domain may already be gone on Vercel's side — still clear our own record.
  }

  await prisma.school.update({ where: { id: schoolId }, data: { customDomain: null, customDomainVerified: false } });
  revalidatePath("/admin/domain");
}

export async function getDnsInstructions(domain: string) {
  const cfg = await getDomainConfig(domain);
  const target = cfg.recommendedCNAME?.[0]?.value ?? "cname.vercel-dns.com";
  const host = domain.split(".")[0] || "@";
  return { host, target };
}
