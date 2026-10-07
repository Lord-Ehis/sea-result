import { DAY_MS } from "@/lib/add-months";
import { resolveSchoolAccess, type SubscriptionWindow } from "@/lib/school-access";

// What the platform owner's "Needs attention" page flags, and when. Pure — no
// database or clock access — so each rule is unit-tested and the page only has
// to fetch rows and render the answer.

export const EXPIRING_SOON_DAYS = 14;
export const STUCK_PAYMENT_MINUTES = 60;
export const STUCK_PAYMENT_MAX_DAYS = 7;
export const FAILED_MESSAGE_DAYS = 14;
export const FAILED_PAYMENT_DAYS = 7;
export const STALLED_AFTER_DAYS = 3;
export const CRON_STALE_HOURS = 36;

export type SchoolStatus = "ACTIVE" | "SUSPENDED" | "PENDING_DELETION";

export type SubscriptionAttentionItem = {
  schoolId: string;
  name: string;
  coverageEndsAt: Date | null;
  /** Whole days left; negative once ended; null when the school has never had a subscription. */
  daysLeft: number | null;
};

export type SubscriptionAttention = {
  /** Locked out: no subscription, or the grace period is over. */
  lapsed: SubscriptionAttentionItem[];
  /** Coverage ended recently; everything still works but they should renew. */
  grace: SubscriptionAttentionItem[];
  /** Still covered, but not for long. */
  expiringSoon: SubscriptionAttentionItem[];
};

const byUrgency = (a: SubscriptionAttentionItem, b: SubscriptionAttentionItem) => (a.daysLeft ?? -Infinity) - (b.daysLeft ?? -Infinity);

/**
 * Sorts schools into the subscription problems the owner can act on. A school
 * the owner has suspended is left out: that was deliberate, not a surprise.
 */
export function subscriptionAttention(
  schools: { id: string; name: string; status: SchoolStatus; subscriptions: SubscriptionWindow[] }[],
  now: Date,
): SubscriptionAttention {
  const out: SubscriptionAttention = { lapsed: [], grace: [], expiringSoon: [] };

  for (const school of schools) {
    if (school.status === "SUSPENDED") continue;
    const access = resolveSchoolAccess({ status: school.status, subscriptions: school.subscriptions, now });
    const item: SubscriptionAttentionItem = { schoolId: school.id, name: school.name, coverageEndsAt: access.coverageEndsAt, daysLeft: access.daysLeft };

    if (access.state === "LAPSED") out.lapsed.push(item);
    else if (access.state === "GRACE") out.grace.push(item);
    else if (access.state === "ACTIVE" && access.daysLeft !== null && access.daysLeft <= EXPIRING_SOON_DAYS) out.expiringSoon.push(item);
  }

  out.lapsed.sort(byUrgency);
  out.grace.sort(byUrgency);
  out.expiringSoon.sort(byUrgency);
  return out;
}

/**
 * What a school that signed up has still not done. Null when it is too new to
 * judge, is not an active school, or has everything in place.
 */
export function onboardingGaps(
  school: { status: SchoolStatus; createdAt: Date; students: number; teachers: number; templates: number },
  now: Date,
): string[] | null {
  if (school.status !== "ACTIVE") return null;
  if (now.getTime() - school.createdAt.getTime() < STALLED_AFTER_DAYS * DAY_MS) return null;

  const gaps: string[] = [];
  if (school.students === 0) gaps.push("No students");
  if (school.teachers === 0) gaps.push("No teachers");
  if (school.templates === 0) gaps.push("No result template");
  return gaps.length > 0 ? gaps : null;
}

/**
 * A payment that was started but never settled: the person left, or our webhook never heard back.
 * Only the last week counts; older ones are abandoned checkouts nobody can act on.
 */
export function isPaymentStuck(payment: { status: "PENDING" | "SUCCESS" | "FAILED"; createdAt: Date }, now: Date): boolean {
  const age = now.getTime() - payment.createdAt.getTime();
  return payment.status === "PENDING" && age > STUCK_PAYMENT_MINUTES * 60_000 && age <= STUCK_PAYMENT_MAX_DAYS * DAY_MS;
}

/** The daily subscription job leaves a timestamp each run; no recent one means reminders and expiries aren't being processed. */
export function cronLooksStale(lastRunAt: Date | null, now: Date): boolean {
  return lastRunAt === null || now.getTime() - lastRunAt.getTime() > CRON_STALE_HOURS * 3_600_000;
}

/** "3 days ago", "today", "in 5 days" — for the owner's lists. */
export function relativeDays(days: number | null): string {
  if (days === null) return "never subscribed";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}
