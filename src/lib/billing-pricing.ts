import { addMonths } from "@/lib/add-months";
import { TERM_NUMBERS, isTermNumber, termLabel, type TermNumber } from "@/lib/term-number";

// Everything about what a subscription costs and how long it covers, as pure
// functions (no database, no clock of its own) so the rules are easy to test
// and the Billing page, sign-up and the payment code all agree.
//
// The rules:
//   - A term costs ₦50,000 and covers 4 months. A session is 3 terms = 12 months.
//   - A full session costs 20% less than three terms: ₦120,000.
//   - Only the payment made while registering gets ₦10,000 off a term (₦40,000).
//     After any payment has gone through, a term is always ₦50,000.
//   - Paying for more coverage adds to what the school already has: the new
//     period starts when the current one ends (or today, if it has run out).
//   - Upgrading to the full session credits what was paid for that session's
//     terms and runs to the end of the session, counted from its first term's
//     start.

export const TERM_PRICE = 50_000;
export const REGISTRATION_DISCOUNT = 10_000;
export const SESSION_DISCOUNT_RATE = 0.2;
export const SESSION_PRICE = Math.round(TERM_PRICE * 3 * (1 - SESSION_DISCOUNT_RATE)); // 120,000
export const TERM_MONTHS = 4;
export const SESSION_MONTHS = 12;

export type Plan = { kind: "TERM"; termNumber: TermNumber } | { kind: "SESSION" };

/** What a school already holds. Only the fields the rules need. */
export type HeldSubscription = {
  billingCycle: "PER_TERM" | "FULL_SESSION";
  termNumber: TermNumber | null;
  session: string;
  amount: number;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  startDate: Date;
  endDate: Date;
  isComplimentary?: boolean;
};

export type Quote =
  | {
      ok: true;
      plan: Plan;
      session: string;
      /** Price before any discount or credit. */
      listPrice: number;
      /** ₦10,000 off, only on the registration payment for a term. */
      registrationDiscount: number;
      /** Paid for this session's terms already — taken off the full-session price. */
      credit: number;
      /** What the school pays. */
      amount: number;
      startDate: Date;
      endDate: Date;
    }
  | { ok: false; reason: string };

const SESSION_PATTERN = /^(\d{4})\/(\d{4})$/;

/** "2026/2027" → start year 2026, or null when it isn't a valid session label. */
export function parseSession(label: string): number | null {
  const m = SESSION_PATTERN.exec(label.trim());
  if (!m) return null;
  const start = Number(m[1]);
  return Number(m[2]) === start + 1 ? start : null;
}

/** The current session and the next one — the two a school can pay for. */
export function sessionOptions(now: Date): string[] {
  const start = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return [`${start}/${start + 1}`, `${start + 1}/${start + 2}`];
}

export function planLabel(plan: Plan): string {
  return plan.kind === "SESSION" ? "Full session" : termLabel(plan.termNumber);
}

// Complimentary access is given, not bought: it stretches coverage, but it
// doesn't count as having paid for a term (so it never blocks buying one)
// and there is nothing in it to credit.
const paid = (s: HeldSubscription) => s.status !== "CANCELLED" && !s.isComplimentary;

/** When the school's coverage currently ends: the latest end among what it holds. */
export function coverageEnd(held: HeldSubscription[]): Date | null {
  const ends = held.filter((s) => s.status !== "CANCELLED").map((s) => s.endDate.getTime());
  return ends.length ? new Date(Math.max(...ends)) : null;
}

/** Where a new period begins: when current coverage ends, or now if it already has. */
export function nextStart(held: HeldSubscription[], now: Date): Date {
  const end = coverageEnd(held);
  return end && end.getTime() > now.getTime() ? end : now;
}

/** Amount already paid toward this session's terms. */
export function sessionCredit(held: HeldSubscription[], session: string): number {
  return held.filter((s) => paid(s) && s.session === session && s.billingCycle === "PER_TERM").reduce((sum, s) => sum + s.amount, 0);
}

/**
 * The period a payment for `plan` covers, given what the school holds.
 * A term starts when current coverage ends and lasts 4 months. A full session
 * ends 12 months after the session's first paid term began (or, with no term
 * paid, 12 months after it starts).
 */
export function coverageWindow(plan: Plan, session: string, held: HeldSubscription[], now: Date): { startDate: Date; endDate: Date } {
  const startDate = nextStart(held, now);
  if (plan.kind === "TERM") return { startDate, endDate: addMonths(startDate, TERM_MONTHS) };

  const firstTerm = held
    .filter((s) => paid(s) && s.session === session && s.billingCycle === "PER_TERM")
    .map((s) => s.startDate.getTime())
    .sort((a, b) => a - b)[0];
  const sessionStart = firstTerm !== undefined ? new Date(firstTerm) : startDate;
  return { startDate, endDate: addMonths(sessionStart, SESSION_MONTHS) };
}

export function quoteSubscription(input: {
  plan: Plan;
  session: string;
  held: HeldSubscription[];
  now: Date;
  /** True only for the payment made while registering (see registrationDiscountAvailable). */
  registration: boolean;
}): Quote {
  const { plan, session, held, now, registration } = input;

  if (parseSession(session) === null) return { ok: false, reason: "Enter the session like 2026/2027." };
  if (plan.kind === "TERM" && !isTermNumber(plan.termNumber)) return { ok: false, reason: "Choose 1st, 2nd or 3rd Term." };

  const sameSession = held.filter((s) => paid(s) && s.session === session);
  if (sameSession.some((s) => s.billingCycle === "FULL_SESSION")) {
    return { ok: false, reason: `The ${session} session is already paid for in full.` };
  }
  if (plan.kind === "TERM" && sameSession.some((s) => s.termNumber === plan.termNumber)) {
    return { ok: false, reason: `${termLabel(plan.termNumber)} ${session} is already paid for.` };
  }

  const { startDate, endDate } = coverageWindow(plan, session, held, now);

  if (plan.kind === "TERM") {
    const discount = registration ? REGISTRATION_DISCOUNT : 0;
    return { ok: true, plan, session, listPrice: TERM_PRICE, registrationDiscount: discount, credit: 0, amount: TERM_PRICE - discount, startDate, endDate };
  }

  const credit = sessionCredit(held, session);
  if (endDate.getTime() <= now.getTime()) return { ok: false, reason: `The ${session} session has already ended.` };
  const covered = coverageEnd(held);
  if (covered && covered.getTime() >= endDate.getTime()) {
    return { ok: false, reason: `Your school is already covered to the end of the ${session} session.` };
  }
  const amount = SESSION_PRICE - credit;
  if (amount <= 0) return { ok: false, reason: `The ${session} terms you've paid for already cover the full session price.` };
  return { ok: true, plan, session, listPrice: SESSION_PRICE, registrationDiscount: 0, credit, amount, startDate, endDate };
}

/**
 * The ₦10,000 registration discount belongs to the payment made while
 * registering, and only until the school has paid anything. So it applies
 * when the school signed up through the wizard (that payment exists, marked
 * as the registration) and no payment has succeeded yet.
 */
export function registrationDiscountAvailable(payments: { isRegistration: boolean; status: "PENDING" | "SUCCESS" | "FAILED" }[]): boolean {
  return payments.some((p) => p.isRegistration) && !payments.some((p) => p.status === "SUCCESS");
}

export const ALL_PLANS: Plan[] = [...TERM_NUMBERS.map((termNumber) => ({ kind: "TERM" as const, termNumber })), { kind: "SESSION" as const }];

/** Plans are sent between client and server as short strings: "1", "2", "3" or "SESSION". */
export function planKey(plan: Plan): string {
  return plan.kind === "SESSION" ? "SESSION" : String(plan.termNumber);
}

export function planFromKey(key: string): Plan | null {
  if (key === "SESSION") return { kind: "SESSION" };
  const n = Number(key);
  return isTermNumber(n) ? { kind: "TERM", termNumber: n } : null;
}

/** Every plan for each session a school can pay for, priced — what the Billing page shows. */
export function quoteGrid(input: { held: HeldSubscription[]; now: Date; registration: boolean }) {
  return sessionOptions(input.now).map((session) => ({
    session,
    plans: ALL_PLANS.map((plan) => ({
      key: planKey(plan),
      label: planLabel(plan),
      quote: quoteSubscription({ plan, session, held: input.held, now: input.now, registration: input.registration }),
    })),
  }));
}
