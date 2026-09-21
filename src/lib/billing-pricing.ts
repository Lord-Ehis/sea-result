import { TERM_NUMBERS, isTermNumber, termLabel, type TermNumber } from "@/lib/term-number";

// Everything about what a subscription costs and how long it covers, as pure
// functions (no database, no clock of its own) so the rules are easy to test
// and the Billing page, sign-up and the payment code all agree.
//
// The rules:
//   - Terms follow the school calendar, whenever a school pays:
//       1st Term  1 Sep – 31 Dec
//       2nd Term  1 Jan – 30 Apr
//       3rd Term  1 May – 31 Aug   (the August break is covered, so results and
//                                   the annual summary can be finished; a 3rd
//                                   Term can be bought until 31 July)
//     A session is 1 Sep – 31 Aug.
//   - A term costs the same whatever part of it is left. A full session costs
//     a set percentage less than three terms (₦50,000 a term and 20% off by
//     default: ₦40,000 a term, ₦120,000 in all). The platform owner can change
//     the term price, the new-school discount and that percentage - see
//     PricingConfig; the figures in these comments are the defaults.
//   - Only the payment made while registering gets the new-school discount off a
//     term (₦10,000 by default: ₦40,000). Every later payment is the full price.
//   - The full session is not offered in May-July (3rd Term); it is offered
//     again from 1 August.
//   - Terms are bought in order — you can't pay for 3rd Term while 1st is unpaid
//     and still running — so coverage never has gaps and no term can be skipped.
//   - Upgrading to the full session credits what was paid for that session's
//     terms, and never charges more than ₦40,000 for each term still to come.

/** The three numbers the platform owner controls (Global settings). */
export type PricingConfig = { termPrice: number; registrationDiscount: number; sessionDiscountPercent: number };

export const DEFAULT_PRICING: PricingConfig = { termPrice: 50_000, registrationDiscount: 10_000, sessionDiscountPercent: 20 };

/** What the three numbers work out to. */
export function derivedPrices(pricing: PricingConfig) {
  const sessionTermPrice = Math.round((pricing.termPrice * (100 - pricing.sessionDiscountPercent)) / 100);
  return {
    termPrice: pricing.termPrice,
    registrationDiscount: pricing.registrationDiscount,
    /** A new school's first term. */
    newSchoolTermPrice: pricing.termPrice - pricing.registrationDiscount,
    sessionDiscountPercent: pricing.sessionDiscountPercent,
    /** What each term of the full session costs. */
    sessionTermPrice,
    sessionPrice: sessionTermPrice * 3,
  };
}

// The defaults, by name - for tests and anywhere no owner setting has been read.
export const TERM_PRICE = DEFAULT_PRICING.termPrice;
export const REGISTRATION_DISCOUNT = DEFAULT_PRICING.registrationDiscount;
export const SESSION_PRICE = derivedPrices(DEFAULT_PRICING).sessionPrice; // 120,000

const TERM_PRICE_MIN = 1_000;
const TERM_PRICE_MAX = 1_000_000;
const MAX_SESSION_DISCOUNT_PERCENT = 50;
const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

/** Checks the three numbers before they are saved (the settings form and the server both use it). */
export function validatePricing(input: { termPrice: unknown; registrationDiscount: unknown; sessionDiscountPercent: unknown }): { ok: true; value: PricingConfig } | { ok: false; error: string } {
  const { termPrice, registrationDiscount, sessionDiscountPercent } = input;
  if (!Number.isInteger(termPrice) || (termPrice as number) < TERM_PRICE_MIN || (termPrice as number) > TERM_PRICE_MAX) {
    return { ok: false, error: `The term price must be a whole number of naira between ${naira(TERM_PRICE_MIN)} and ${naira(TERM_PRICE_MAX)}.` };
  }
  const price = termPrice as number;
  const maxDiscount = price - TERM_PRICE_MIN;
  if (!Number.isInteger(registrationDiscount) || (registrationDiscount as number) < 0 || (registrationDiscount as number) > maxDiscount) {
    return { ok: false, error: `The new-school discount must be a whole number of naira from ₦0 to ${naira(maxDiscount)} (the term price less ${naira(TERM_PRICE_MIN)}).` };
  }
  if (!Number.isInteger(sessionDiscountPercent) || (sessionDiscountPercent as number) < 0 || (sessionDiscountPercent as number) > MAX_SESSION_DISCOUNT_PERCENT) {
    return { ok: false, error: `The full-session discount must be a whole percentage from 0 to ${MAX_SESSION_DISCOUNT_PERCENT}.` };
  }
  return { ok: true, value: { termPrice: price, registrationDiscount: registrationDiscount as number, sessionDiscountPercent: sessionDiscountPercent as number } };
}

/** The full session is only worth offering while at least this many terms of it are still to come. */
export const MIN_TERMS_FOR_SESSION = 2;

/** May, June and July (UTC month numbers) are 3rd Term: the full session is not sold then. */
const FULL_SESSION_CLOSED_MONTHS = [4, 5, 6];

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
      /** Full session only: terms of the session that are already over, which aren't charged for. */
      pastTermsDiscount: number;
      /** What the school pays. */
      amount: number;
      startDate: Date;
      endDate: Date;
    }
  | { ok: false; reason: string };

// ─── Calendar ────────────────────────────────────────────────────────────────

const SESSION_PATTERN = /^(\d{4})\/(\d{4})$/;

/** "2026/2027" → start year 2026, or null when it isn't a valid session label. */
export function parseSession(label: string): number | null {
  const m = SESSION_PATTERN.exec(label.trim());
  if (!m) return null;
  const start = Number(m[1]);
  return Number(m[2]) === start + 1 ? start : null;
}

const sessionLabel = (startYear: number) => `${startYear}/${startYear + 1}`;
const startOfDay = (y: number, month0: number, day: number) => new Date(Date.UTC(y, month0, day));
const endOfDay = (y: number, month0: number, day: number) => new Date(Date.UTC(y, month0, day, 23, 59, 59, 999));

/** One term on the calendar: when it starts, until when it can be bought, and how far paying for it covers. */
export type TermSlot = { session: string; termNumber: TermNumber; startsAt: Date; buyUntil: Date; coversUntil: Date };

export function termSlot(session: string, termNumber: TermNumber): TermSlot | null {
  const y = parseSession(session);
  if (y === null) return null;
  switch (termNumber) {
    case 1:
      return { session, termNumber, startsAt: startOfDay(y, 8, 1), buyUntil: endOfDay(y, 11, 31), coversUntil: endOfDay(y, 11, 31) };
    case 2:
      return { session, termNumber, startsAt: startOfDay(y + 1, 0, 1), buyUntil: endOfDay(y + 1, 3, 30), coversUntil: endOfDay(y + 1, 3, 30) };
    case 3:
      return { session, termNumber, startsAt: startOfDay(y + 1, 4, 1), buyUntil: endOfDay(y + 1, 6, 31), coversUntil: endOfDay(y + 1, 7, 31) };
  }
}

/** Last day the session covers: 31 August. */
export function sessionEnd(session: string): Date | null {
  const y = parseSession(session);
  return y === null ? null : endOfDay(y + 1, 7, 31);
}

/** The term that comes right before this one (3rd Term of the previous session, for a 1st Term). */
function previousSlot(slot: TermSlot): TermSlot {
  if (slot.termNumber > 1) return termSlot(slot.session, (slot.termNumber - 1) as TermNumber)!;
  return termSlot(sessionLabel(parseSession(slot.session)! - 1), 3)!;
}

/** The term that comes right after this one. */
function nextSlot(slot: TermSlot): TermSlot {
  if (slot.termNumber < 3) return termSlot(slot.session, (slot.termNumber + 1) as TermNumber)!;
  return termSlot(sessionLabel(parseSession(slot.session)! + 1), 1)!;
}

/** The current session and the next one — the two a school can pay for. */
export function sessionOptions(now: Date): string[] {
  const start = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return [sessionLabel(start), sessionLabel(start + 1)];
}

export function planLabel(plan: Plan): string {
  return plan.kind === "SESSION" ? "Full session" : termLabel(plan.termNumber);
}

// ─── What the school already holds ───────────────────────────────────────────

// Complimentary access is given, not bought: it stretches coverage, but it
// doesn't count as having paid for a term (so it never blocks buying one)
// and there is nothing in it to credit.
const paid = (s: HeldSubscription) => s.status !== "CANCELLED" && !s.isComplimentary;

/** When the school's coverage currently ends: the latest end among what it holds. */
export function coverageEnd(held: HeldSubscription[]): Date | null {
  const ends = held.filter((s) => s.status !== "CANCELLED").map((s) => s.endDate.getTime());
  return ends.length ? new Date(Math.max(...ends)) : null;
}

/** Where a new period begins: right after current coverage ends, or now if it already has. */
export function nextStart(held: HeldSubscription[], now: Date): Date {
  const end = coverageEnd(held);
  return end && end.getTime() > now.getTime() ? new Date(end.getTime() + 1) : now;
}

/** Amount already paid toward this session's terms. */
export function sessionCredit(held: HeldSubscription[], session: string): number {
  return held.filter((s) => paid(s) && s.session === session && s.billingCycle === "PER_TERM").reduce((sum, s) => sum + s.amount, 0);
}

const isPaidFor = (held: HeldSubscription[], slot: TermSlot) =>
  held.some((s) => paid(s) && s.session === slot.session && (s.billingCycle === "FULL_SESSION" || s.termNumber === slot.termNumber));

/** A term counts as covered when the school's coverage already reaches the end of it. */
const isCovered = (held: HeldSubscription[], slot: TermSlot) => {
  const end = coverageEnd(held);
  return end !== null && end.getTime() >= slot.coversUntil.getTime();
};

/** Whether the term before this one is out of the way: already over, or already covered. */
function precedingTermSettled(held: HeldSubscription[], slot: TermSlot, now: Date): { ok: true } | { ok: false; reason: string } {
  const prev = previousSlot(slot);
  if (prev.buyUntil.getTime() <= now.getTime() || isCovered(held, prev)) return { ok: true };
  return { ok: false, reason: `Pay ${termLabel(prev.termNumber)} ${prev.session} first.` };
}

// ─── Quotes ──────────────────────────────────────────────────────────────────

const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function quoteSubscription(input: {
  plan: Plan;
  session: string;
  held: HeldSubscription[];
  now: Date;
  /** True only for the payment made while registering (see registrationDiscountAvailable). */
  registration: boolean;
  /** The owner's current prices; the defaults when omitted. */
  pricing?: PricingConfig;
}): Quote {
  const { plan, session, held, now, registration } = input;
  const prices = derivedPrices(input.pricing ?? DEFAULT_PRICING);

  if (parseSession(session) === null) return { ok: false, reason: "Enter the session like 2026/2027." };
  if (plan.kind === "TERM" && !isTermNumber(plan.termNumber)) return { ok: false, reason: "Choose 1st, 2nd or 3rd Term." };

  if (held.some((s) => paid(s) && s.session === session && s.billingCycle === "FULL_SESSION")) {
    return { ok: false, reason: `The ${session} session is already paid for in full.` };
  }

  const covered = coverageEnd(held);
  const startDate = nextStart(held, now);

  if (plan.kind === "TERM") {
    const slot = termSlot(session, plan.termNumber)!;
    const name = `${termLabel(plan.termNumber)} ${session}`;
    if (isPaidFor(held, slot)) return { ok: false, reason: `${name} is already paid for.` };
    if (slot.buyUntil.getTime() <= now.getTime()) return { ok: false, reason: `${name} has ended.` };
    if (covered && covered.getTime() >= slot.coversUntil.getTime()) return { ok: false, reason: `Already covered until ${day(covered)}.` };
    const order = precedingTermSettled(held, slot, now);
    if (!order.ok) return order;

    const discount = registration ? prices.registrationDiscount : 0;
    return {
      ok: true,
      plan,
      session,
      listPrice: prices.termPrice,
      registrationDiscount: discount,
      credit: 0,
      pastTermsDiscount: 0,
      amount: prices.termPrice - discount,
      startDate,
      endDate: slot.coversUntil,
    };
  }

  if (FULL_SESSION_CLOSED_MONTHS.includes(now.getUTCMonth())) {
    return { ok: false, reason: "The full session isn't offered during 3rd Term (May–July). It's available again from 1 August." };
  }
  const end = sessionEnd(session)!;
  if (end.getTime() <= now.getTime()) return { ok: false, reason: `The ${session} session has already ended.` };
  if (covered && covered.getTime() >= end.getTime()) return { ok: false, reason: `Your school is already covered to the end of ${session}.` };

  // The terms of this session that are still to come and not yet covered.
  const remaining = TERM_NUMBERS.map((n) => termSlot(session, n)!).filter((s) => s.buyUntil.getTime() > now.getTime() && !isCovered(held, s) && !isPaidFor(held, s));
  if (remaining.length < MIN_TERMS_FOR_SESSION) {
    return { ok: false, reason: remaining.length === 1 ? `Only ${termLabel(remaining[0].termNumber)} is left in ${session} — buy that term instead.` : `Nothing left to buy in ${session}.` };
  }
  const order = precedingTermSettled(held, remaining[0], now);
  if (!order.ok) return order;

  const credit = sessionCredit(held, session);
  const byCredit = prices.sessionPrice - credit;
  const byRemaining = prices.sessionTermPrice * remaining.length;
  const amount = Math.min(byCredit, byRemaining);
  if (amount <= 0) return { ok: false, reason: `The terms you've paid for in ${session} already cover the full session price.` };
  return {
    ok: true,
    plan,
    session,
    listPrice: prices.sessionPrice,
    registrationDiscount: 0,
    credit,
    pastTermsDiscount: byCredit - amount,
    amount,
    startDate,
    endDate: end,
  };
}

/**
 * The period a payment that has *already succeeded* covers. Unlike a quote this
 * never refuses: if the term went by (or was bought twice at once) while the
 * payment was being made, the payment covers the next term instead.
 */
export function paidWindow(plan: Plan, session: string, held: HeldSubscription[], now: Date): { startDate: Date; endDate: Date } {
  const startDate = nextStart(held, now);
  if (plan.kind === "SESSION") {
    let end = sessionEnd(session) ?? startDate;
    while (end.getTime() <= startDate.getTime()) end = sessionEnd(sessionLabel(parseSession(session)! + 1)) ?? end;
    return { startDate, endDate: end };
  }
  let slot = termSlot(session, plan.termNumber) ?? termSlot(sessionOptions(now)[0], 1)!;
  while (slot.coversUntil.getTime() <= startDate.getTime()) slot = nextSlot(slot);
  return { startDate, endDate: slot.coversUntil };
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
export function quoteGrid(input: { held: HeldSubscription[]; now: Date; registration: boolean; pricing?: PricingConfig }) {
  return sessionOptions(input.now).map((session) => ({
    session,
    plans: ALL_PLANS.map((plan) => ({
      key: planKey(plan),
      label: planLabel(plan),
      quote: quoteSubscription({ plan, session, held: input.held, now: input.now, registration: input.registration, pricing: input.pricing }),
    })),
  }));
}

/**
 * What a school with nothing yet can start with: the one term that is next on
 * the calendar, and the full session if enough of it is left. Used by sign-up.
 */
export function startingOffer(now: Date, pricing: PricingConfig = DEFAULT_PRICING) {
  const grid = quoteGrid({ held: [], now, registration: true, pricing });
  const termGroup = grid.find((g) => g.plans.some((p) => p.key !== "SESSION" && p.quote.ok));
  const term = termGroup?.plans.find((p) => p.key !== "SESSION" && p.quote.ok);
  const fullSession = grid.find((g) => g.plans.some((p) => p.key === "SESSION" && p.quote.ok));
  return {
    term: term && termGroup ? { key: term.key, label: term.label, session: termGroup.session, quote: term.quote } : null,
    session: fullSession ? { session: fullSession.session, quote: fullSession.plans.find((p) => p.key === "SESSION")!.quote } : null,
  };
}

// ─── The price breakdown a payment carries ───────────────────────────────────

/** The quote as it stood when the payment started, kept on the payment. */
export type PaymentBreakdown = { listPrice: number; registrationDiscount: number; credit: number; pastTermsDiscount: number };

export function breakdownFromQuote(q: Extract<Quote, { ok: true }>): PaymentBreakdown {
  return { listPrice: q.listPrice, registrationDiscount: q.registrationDiscount, credit: q.credit, pastTermsDiscount: q.pastTermsDiscount };
}

/** Reads a stored breakdown back; null when there is none or it isn't shaped right. */
export function readBreakdown(value: unknown): PaymentBreakdown | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const keys = ["listPrice", "registrationDiscount", "credit", "pastTermsDiscount"] as const;
  if (!keys.every((k) => typeof v[k] === "number" && Number.isFinite(v[k] as number))) return null;
  return { listPrice: v.listPrice as number, registrationDiscount: v.registrationDiscount as number, credit: v.credit as number, pastTermsDiscount: v.pastTermsDiscount as number };
}

/**
 * The credit and the human-readable notes recorded on the subscription a
 * payment creates. They come from the breakdown saved when the payment started,
 * so a price change in between can't mislabel it. Payments from before
 * breakdowns were kept fall back to the default prices, as they always did.
 */
export function subscriptionNotes(input: { breakdown: PaymentBreakdown | null; plan: Plan; session: string; amount: number; isRegistration: boolean }): { credit: number; notes: string[] } {
  const { plan, session, amount, isRegistration } = input;
  const b: PaymentBreakdown =
    input.breakdown ??
    (plan.kind === "SESSION"
      ? { listPrice: SESSION_PRICE, registrationDiscount: 0, credit: Math.max(0, SESSION_PRICE - amount), pastTermsDiscount: 0 }
      : { listPrice: TERM_PRICE, registrationDiscount: isRegistration && amount < TERM_PRICE ? REGISTRATION_DISCOUNT : 0, credit: 0, pastTermsDiscount: 0 });
  const notes: string[] = [];
  if (b.registrationDiscount > 0) notes.push(`Registration discount: ${naira(b.registrationDiscount)} off`);
  if (b.credit > 0) notes.push(`${naira(b.credit)} credited for terms already paid in ${session}`);
  if (b.pastTermsDiscount > 0) notes.push(`${naira(b.pastTermsDiscount)} off for terms already over in ${session}`);
  return { credit: b.credit, notes };
}
