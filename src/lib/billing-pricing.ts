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
//   - A term costs ₦50,000 whatever part of it is left. A full session costs
//     20% less than three terms: ₦40,000 a term, ₦120,000 in all.
//   - Only the payment made while registering gets ₦10,000 off a term (₦40,000).
//   - Terms are bought in order — you can't pay for 3rd Term while 1st is unpaid
//     and still running — so coverage never has gaps and no term can be skipped.
//   - Upgrading to the full session credits what was paid for that session's
//     terms, and never charges more than ₦40,000 for each term still to come.

export const TERM_PRICE = 50_000;
export const REGISTRATION_DISCOUNT = 10_000;
export const SESSION_DISCOUNT_RATE = 0.2;
export const SESSION_PRICE = Math.round(TERM_PRICE * 3 * (1 - SESSION_DISCOUNT_RATE)); // 120,000
export const SESSION_TERM_PRICE = SESSION_PRICE / 3; // 40,000
/** The full session is only worth offering while at least this many terms of it are still to come. */
export const MIN_TERMS_FOR_SESSION = 2;

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
}): Quote {
  const { plan, session, held, now, registration } = input;

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

    const discount = registration ? REGISTRATION_DISCOUNT : 0;
    return {
      ok: true,
      plan,
      session,
      listPrice: TERM_PRICE,
      registrationDiscount: discount,
      credit: 0,
      pastTermsDiscount: 0,
      amount: TERM_PRICE - discount,
      startDate,
      endDate: slot.coversUntil,
    };
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
  const byCredit = SESSION_PRICE - credit;
  const byRemaining = SESSION_TERM_PRICE * remaining.length;
  const amount = Math.min(byCredit, byRemaining);
  if (amount <= 0) return { ok: false, reason: `The terms you've paid for in ${session} already cover the full session price.` };
  return {
    ok: true,
    plan,
    session,
    listPrice: SESSION_PRICE,
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

/**
 * What a school with nothing yet can start with: the one term that is next on
 * the calendar, and the full session if enough of it is left. Used by sign-up.
 */
export function startingOffer(now: Date) {
  const grid = quoteGrid({ held: [], now, registration: true });
  const termGroup = grid.find((g) => g.plans.some((p) => p.key !== "SESSION" && p.quote.ok));
  const term = termGroup?.plans.find((p) => p.key !== "SESSION" && p.quote.ok);
  const fullSession = grid.find((g) => g.plans.some((p) => p.key === "SESSION" && p.quote.ok));
  return {
    term: term && termGroup ? { key: term.key, label: term.label, session: termGroup.session, quote: term.quote } : null,
    session: fullSession ? { session: fullSession.session, quote: fullSession.plans.find((p) => p.key === "SESSION")!.quote } : null,
  };
}
