import type { PlatformEventAction } from "@prisma/client";

// The platform owner's audit log: one timeline built from several tables. This
// module is pure (no database, no clock) so how each kind of event reads, and
// how the timeline is filtered and paged, is unit-tested; the page only
// fetches rows and calls these.

export type AuditCategory = "SCHOOLS" | "ACCOUNTS" | "BILLING" | "SETTINGS" | "REQUESTS" | "ANNOUNCEMENTS";

export const CATEGORY_LABEL: Record<AuditCategory, string> = {
  SCHOOLS: "Schools",
  ACCOUNTS: "Accounts",
  BILLING: "Billing",
  SETTINGS: "Settings",
  REQUESTS: "Deletion requests",
  ANNOUNCEMENTS: "Announcements",
};

export const AUDIT_CATEGORIES = Object.keys(CATEGORY_LABEL) as AuditCategory[];

export const isAuditCategory = (v: unknown): v is AuditCategory => typeof v === "string" && v in CATEGORY_LABEL;

export type AuditEntry = {
  id: string;
  at: Date;
  category: AuditCategory;
  title: string;
  detail: string | null;
  /** Who did it; null for things nobody "did" (a school signing itself up). */
  actor: string | null;
  schoolId: string | null;
};

export const PROVIDER_LABEL: Record<string, string> = {
  PAYSTACK: "Paystack",
  SMS_TERMII: "Termii (SMS)",
  SMS_AFRICAS_TALKING: "Africa's Talking (SMS)",
  EMAIL_RESEND: "Resend (email)",
  EMAIL_POSTMARK: "Postmark (email)",
};

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

type Meta = Record<string, unknown>;
const asMeta = (m: unknown): Meta => (m && typeof m === "object" && !Array.isArray(m) ? (m as Meta) : {});

/** How an event from the platform_events table reads on the timeline. */
export function describePlatformEvent(action: PlatformEventAction, metadata: unknown): { category: AuditCategory; title: string; detail: string | null } {
  const m = asMeta(metadata);
  const provider = typeof m.provider === "string" ? (PROVIDER_LABEL[m.provider] ?? m.provider) : "a provider";
  switch (action) {
    case "SCHOOL_SUSPENDED":
      return { category: "SCHOOLS", title: "School switched off", detail: "Staff at this school are locked out until it is switched back on." };
    case "SCHOOL_REACTIVATED":
      return { category: "SCHOOLS", title: "School switched back on", detail: null };
    case "PROVIDER_CONFIGURED":
      return { category: "SETTINGS", title: `${provider} settings saved`, detail: "Keys were entered or replaced. The keys themselves are never logged." };
    case "PROVIDER_CLEARED":
      return { category: "SETTINGS", title: `${provider} settings removed`, detail: null };
    case "PASSWORD_LINK_SENT":
      return {
        category: "ACCOUNTS",
        title: "Password link sent",
        detail: m.delivered === false ? "A set-password link was created, but the email could not be sent." : "A link to set a new password was emailed to the account.",
      };
  }
}

type Pricing = { termPrice: number; registrationDiscount: number; sessionDiscountPercent: number };

/** "Term price ₦40,000 → ₦45,000" — only the fields that changed. */
export function describePricingChange(before: Partial<Pricing>, after: Partial<Pricing>): string {
  const parts: string[] = [];
  if (before.termPrice !== after.termPrice) parts.push(`Term price ${naira(before.termPrice ?? 0)} → ${naira(after.termPrice ?? 0)}`);
  if (before.registrationDiscount !== after.registrationDiscount) parts.push(`New-school discount ${naira(before.registrationDiscount ?? 0)} → ${naira(after.registrationDiscount ?? 0)}`);
  if (before.sessionDiscountPercent !== after.sessionDiscountPercent) parts.push(`Full-session discount ${before.sessionDiscountPercent ?? 0}% → ${after.sessionDiscountPercent ?? 0}%`);
  return parts.join("; ") || "Prices re-saved with no change";
}

export function describeEmailChange(account: string, metadata: unknown): string {
  const m = asMeta(metadata);
  const from = typeof m.from === "string" ? m.from : "—";
  const to = typeof m.to === "string" ? m.to : "—";
  return `${account}: ${from} → ${to}`;
}

export type AuditFilter = { category?: AuditCategory; from?: Date; to?: Date };

/** Newest first, restricted to the chosen category and date range (both ends inclusive). */
export function filterAndSort(entries: AuditEntry[], filter: AuditFilter): AuditEntry[] {
  return entries
    .filter((e) => (!filter.category || e.category === filter.category) && (!filter.from || e.at >= filter.from) && (!filter.to || e.at <= filter.to))
    .sort((a, b) => b.at.getTime() - a.at.getTime() || a.id.localeCompare(b.id));
}

export function paginate<T>(items: T[], page: number, size: number): { items: T[]; page: number; pages: number; total: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { items: items.slice((current - 1) * size, current * size), page: current, pages, total: items.length };
}

/** "2026-10-07" -> start or end of that day (UTC); anything else -> undefined. */
export function parseDay(value: string | undefined, end: boolean): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Free access is recorded as a note like "Complimentary access: Pilot school (granted by platform owner abc123)".
 * Splits it into the reason and who granted it.
 */
export function parseComplimentaryNote(note: string | null): { reason: string; ownerId: string | null } {
  const text = note ?? "";
  const match = text.match(/\s*\(granted by platform owner (\S+?)\)\s*$/);
  const reason = text.replace(/\s*\(granted by platform owner \S+?\)\s*$/, "").replace(/^Complimentary access:\s*/i, "").trim();
  return { reason: reason || "No reason given", ownerId: match ? match[1] : null };
}
