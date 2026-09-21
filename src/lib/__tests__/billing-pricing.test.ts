import { describe, expect, it } from "vitest";
import {
  REGISTRATION_DISCOUNT,
  SESSION_PRICE,
  TERM_PRICE,
  coverageEnd,
  nextStart,
  paidWindow,
  parseSession,
  planFromKey,
  planKey,
  quoteSubscription,
  registrationDiscountAvailable,
  sessionCredit,
  sessionEnd,
  sessionOptions,
  startingOffer,
  termSlot,
  type HeldSubscription,
  type Plan,
} from "../billing-pricing";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const eod = (s: string) => new Date(`${s}T23:59:59.999Z`);
const term = (n: 1 | 2 | 3): Plan => ({ kind: "TERM", termNumber: n });
const session: Plan = { kind: "SESSION" };
const SESS = "2026/2027";

function heldTerm(n: 1 | 2 | 3, start: Date, end: Date, amount = TERM_PRICE, sess = SESS): HeldSubscription {
  return { billingCycle: "PER_TERM", termNumber: n, session: sess, amount, status: "ACTIVE", startDate: start, endDate: end };
}
const t1 = (amount = TERM_PRICE) => heldTerm(1, d("2026-09-01"), eod("2026-12-31"), amount);
const t2 = (amount = TERM_PRICE) => heldTerm(2, d("2027-01-01"), eod("2027-04-30"), amount);
const quote = (plan: Plan, held: HeldSubscription[], now: string, opts: { session?: string; registration?: boolean } = {}) =>
  quoteSubscription({ plan, session: opts.session ?? SESS, held, now: d(now), registration: opts.registration ?? false });

describe("prices", () => {
  it("has the agreed numbers", () => {
    expect(TERM_PRICE).toBe(50_000);
    expect(REGISTRATION_DISCOUNT).toBe(10_000);
    expect(SESSION_PRICE).toBe(120_000);
  });
});

describe("the school calendar", () => {
  it("1st Term runs Sept–Dec, 2nd Jan–Apr, 3rd May–Aug (August break covered)", () => {
    expect(termSlot(SESS, 1)).toMatchObject({ startsAt: d("2026-09-01"), buyUntil: eod("2026-12-31"), coversUntil: eod("2026-12-31") });
    expect(termSlot(SESS, 2)).toMatchObject({ startsAt: d("2027-01-01"), buyUntil: eod("2027-04-30"), coversUntil: eod("2027-04-30") });
    expect(termSlot(SESS, 3)).toMatchObject({ startsAt: d("2027-05-01"), buyUntil: eod("2027-07-31"), coversUntil: eod("2027-08-31") });
    expect(sessionEnd(SESS)).toEqual(eod("2027-08-31"));
  });

  it("parses only well-formed consecutive sessions", () => {
    expect(parseSession("2026/2027")).toBe(2026);
    expect(parseSession(" 2026/2027 ")).toBe(2026);
    expect(parseSession("2026/2027/x")).toBeNull();
    expect(parseSession("2026/2026")).toBeNull();
    expect(termSlot("nonsense", 1)).toBeNull();
  });

  it("offers the current and next session (the year turns over in August)", () => {
    expect(sessionOptions(d("2026-09-21"))).toEqual(["2026/2027", "2027/2028"]);
    expect(sessionOptions(d("2027-03-01"))).toEqual(["2026/2027", "2027/2028"]);
    expect(sessionOptions(d("2026-07-31"))).toEqual(["2025/2026", "2026/2027"]);
    expect(sessionOptions(d("2026-08-01"))).toEqual(["2026/2027", "2027/2028"]);
  });
});

describe("a term ends at the term's end, whenever it is bought", () => {
  it("October: covered from today to 31 December — not four months on", () => {
    expect(quote(term(1), [], "2026-10-15")).toMatchObject({ ok: true, amount: 50_000, startDate: d("2026-10-15"), endDate: eod("2026-12-31") });
  });

  it("the last week of 1st Term still costs the full price", () => {
    expect(quote(term(1), [], "2026-12-28")).toMatchObject({ ok: true, amount: 50_000, endDate: eod("2026-12-31") });
  });

  it("2nd Term bought in November starts the moment 1st Term ends, and ends 30 April", () => {
    const q = quote(term(2), [t1()], "2026-11-10");
    expect(q).toMatchObject({ ok: true, amount: 50_000, endDate: eod("2027-04-30") });
    if (q.ok) expect(q.startDate).toEqual(d("2027-01-01"));
  });

  it("3rd Term runs through August", () => {
    expect(quote(term(3), [t1(), t2()], "2027-03-01")).toMatchObject({ ok: true, endDate: eod("2027-08-31") });
  });

  it("a January joiner pays the full price for 2nd Term and is covered to 30 April", () => {
    expect(quote(term(2), [], "2027-01-20")).toMatchObject({ ok: true, amount: 50_000, startDate: d("2027-01-20"), endDate: eod("2027-04-30") });
  });
});

describe("terms are bought in order — none can be skipped", () => {
  it("a new school in October can buy 1st Term only", () => {
    expect(quote(term(1), [], "2026-10-15").ok).toBe(true);
    expect(quote(term(2), [], "2026-10-15")).toEqual({ ok: false, reason: "Pay 1st Term 2026/2027 first." });
    expect(quote(term(3), [], "2026-10-15")).toEqual({ ok: false, reason: "Pay 2nd Term 2026/2027 first." });
  });

  it("paying 1st Term unlocks 2nd, then 3rd", () => {
    expect(quote(term(2), [t1()], "2026-10-15").ok).toBe(true);
    expect(quote(term(3), [t1()], "2026-10-15").ok).toBe(false);
    expect(quote(term(3), [t1(), t2()], "2026-10-15").ok).toBe(true);
  });

  it("a term that has ended can't be bought, and doesn't hold up the next one", () => {
    expect(quote(term(1), [], "2027-01-20")).toEqual({ ok: false, reason: "1st Term 2026/2027 has ended." });
    expect(quote(term(2), [], "2027-01-20").ok).toBe(true);
    expect(quote(term(3), [], "2027-01-20")).toEqual({ ok: false, reason: "Pay 2nd Term 2026/2027 first." });
  });

  it("3rd Term can be bought until 31 July; after that the next session's 1st Term is on offer", () => {
    expect(quote(term(3), [t1(), t2()], "2027-07-30").ok).toBe(true);
    expect(quote(term(3), [t1(), t2()], "2027-08-10")).toEqual({ ok: false, reason: "3rd Term 2026/2027 has ended." });
    // in July the next session's 1st Term has to wait for 3rd Term…
    expect(quote(term(1), [], "2027-07-20", { session: "2027/2028" })).toEqual({ ok: false, reason: "Pay 3rd Term 2026/2027 first." });
    // …but in the August break it is available at once, covering today to 31 December
    expect(quote(term(1), [], "2027-08-10", { session: "2027/2028" })).toMatchObject({ ok: true, startDate: d("2027-08-10"), endDate: eod("2027-12-31") });
  });

  it("next session's 1st Term picks up where the 3rd Term's August cover ends", () => {
    const held = [t1(), t2(), heldTerm(3, d("2027-05-01"), eod("2027-08-31"))];
    const q = quote(term(1), held, "2027-08-10", { session: "2027/2028" });
    if (q.ok) expect(q.startDate).toEqual(d("2027-09-01"));
    expect(q.ok).toBe(true);
  });
});

describe("registration discount", () => {
  it("applies only to the registration payment, and only until something has been paid", () => {
    expect(registrationDiscountAvailable([{ isRegistration: true, status: "PENDING" }])).toBe(true);
    expect(registrationDiscountAvailable([{ isRegistration: true, status: "FAILED" }])).toBe(true);
    expect(registrationDiscountAvailable([{ isRegistration: true, status: "SUCCESS" }])).toBe(false);
    expect(
      registrationDiscountAvailable([
        { isRegistration: true, status: "PENDING" },
        { isRegistration: false, status: "SUCCESS" },
      ]),
    ).toBe(false);
  });

  it("is never offered to a school that did not register through the wizard", () => {
    expect(registrationDiscountAvailable([])).toBe(false);
    expect(registrationDiscountAvailable([{ isRegistration: false, status: "PENDING" }])).toBe(false);
  });

  it("takes ₦10,000 off a term when registering, and nothing off afterwards", () => {
    expect(quote(term(1), [], "2026-09-05", { registration: true })).toMatchObject({ ok: true, amount: 40_000, registrationDiscount: 10_000, listPrice: 50_000 });
    expect(quote(term(1), [], "2026-09-05")).toMatchObject({ ok: true, amount: 50_000, registrationDiscount: 0 });
  });

  it("never discounts the full session, even when registering", () => {
    expect(quote(session, [], "2026-09-05", { registration: true })).toMatchObject({ ok: true, amount: 120_000, registrationDiscount: 0, credit: 0 });
  });
});

describe("full session", () => {
  it("costs ₦120,000 and runs to 31 August when bought at the start", () => {
    expect(quote(session, [], "2026-09-05")).toMatchObject({ ok: true, amount: 120_000, credit: 0, pastTermsDiscount: 0, endDate: eod("2027-08-31") });
  });

  it("after 1st Term paid at ₦40,000: pay ₦80,000, covered to 31 August", () => {
    const q = quote(session, [t1(40_000)], "2026-10-15");
    expect(q).toMatchObject({ ok: true, amount: 80_000, credit: 40_000, listPrice: 120_000, pastTermsDiscount: 0, endDate: eod("2027-08-31") });
    if (q.ok) expect(q.startDate).toEqual(d("2027-01-01")); // picks up where 1st Term ends
  });

  it("after 1st Term paid at ₦50,000: pay ₦70,000", () => {
    expect(quote(session, [t1(50_000)], "2026-10-15")).toMatchObject({ ok: true, amount: 70_000, credit: 50_000 });
  });

  it("a January joiner pays ₦40,000 for each of the 2 terms left: ₦80,000", () => {
    expect(quote(session, [], "2027-01-20")).toMatchObject({ ok: true, amount: 80_000, credit: 0, pastTermsDiscount: 40_000, endDate: eod("2027-08-31") });
  });

  it("is not offered when only one term is left — buy the term instead", () => {
    expect(quote(session, [], "2027-05-10")).toEqual({ ok: false, reason: "Only 3rd Term is left in 2026/2027 — buy that term instead." });
    expect(quote(session, [t1(), t2()], "2027-02-10")).toEqual({ ok: false, reason: "Only 3rd Term is left in 2026/2027 — buy that term instead." });
  });

  it("can't be bought for next session while this one's terms are still owing", () => {
    expect(quote(session, [], "2026-10-15", { session: "2027/2028" }).ok).toBe(false);
    expect(quote(session, [t1(), t2(), heldTerm(3, d("2027-05-01"), eod("2027-08-31"))], "2027-05-10", { session: "2027/2028" }).ok).toBe(true);
  });

  it("refuses once the session is paid in full, is over, or is covered to its end", () => {
    const full: HeldSubscription = { billingCycle: "FULL_SESSION", termNumber: null, session: SESS, amount: 120_000, status: "ACTIVE", startDate: d("2026-09-01"), endDate: eod("2027-08-31") };
    expect(quote(session, [full], "2026-10-15").ok).toBe(false);
    expect(quote(session, [], "2027-09-05")).toEqual({ ok: false, reason: "The 2026/2027 session has already ended." });
  });

  it("credits every term paid for that session", () => {
    expect(sessionCredit([t1(40_000), t2(50_000)], SESS)).toBe(90_000);
    expect(sessionCredit([t1(50_000)], "2027/2028")).toBe(0);
  });
});

describe("duplicates and bad input", () => {
  it("refuses the same term for the same session, even after it has expired", () => {
    expect(quote(term(1), [{ ...t1(), status: "EXPIRED" }], "2026-10-15")).toEqual({ ok: false, reason: "1st Term 2026/2027 is already paid for." });
  });

  it("allows the same term in a different session", () => {
    expect(quote(term(1), [t1()], "2027-08-10", { session: "2027/2028" }).ok).toBe(true);
  });

  it("refuses any term once the session is paid in full", () => {
    const full: HeldSubscription = { billingCycle: "FULL_SESSION", termNumber: null, session: SESS, amount: 120_000, status: "ACTIVE", startDate: d("2026-09-01"), endDate: eod("2027-08-31") };
    expect(quote(term(2), [full], "2026-10-15").ok).toBe(false);
  });

  it("a cancelled subscription does not count", () => {
    expect(quote(term(1), [{ ...t1(), status: "CANCELLED" }], "2026-10-15").ok).toBe(true);
  });

  it("rejects a session label that is not a real session", () => {
    for (const bad of ["2026", "2026/2028", "26/27", "", "Term 1, 2026/2027"]) expect(quote(term(1), [], "2026-10-15", { session: bad }).ok).toBe(false);
  });
});

describe("complimentary access (Graceland)", () => {
  const complimentary: HeldSubscription = {
    billingCycle: "FULL_SESSION",
    termNumber: null,
    session: SESS,
    amount: 0,
    status: "ACTIVE",
    startDate: d("2026-09-21"),
    endDate: eod("2026-12-31"),
    isComplimentary: true,
  };

  it("counts as coverage but is not a payment: 1st Term shows as already covered, 2nd Term can be bought from 1 January", () => {
    expect(quote(term(1), [complimentary], "2026-10-01")).toEqual({ ok: false, reason: "Already covered until 31 Dec 2026." });
    const q = quote(term(2), [complimentary], "2026-10-01");
    expect(q).toMatchObject({ ok: true, amount: 50_000, endDate: eod("2027-04-30") });
    if (q.ok) expect(q.startDate).toEqual(d("2027-01-01"));
  });

  it("earns no credit, and the full session covers only the terms still uncovered", () => {
    expect(sessionCredit([complimentary], SESS)).toBe(0);
    expect(quote(session, [complimentary], "2026-10-01")).toMatchObject({ ok: true, amount: 80_000, credit: 0 });
  });
});

describe("subscriptions from before terms followed the calendar (Bamaka)", () => {
  const legacy = heldTerm(1, d("2026-09-15"), d("2027-01-15"), 40_000);

  it("the next term begins where the old period ends and runs to the term's end", () => {
    const q = quote(term(2), [legacy], "2026-10-01");
    expect(q).toMatchObject({ ok: true, endDate: eod("2027-04-30") });
    if (q.ok) expect(q.startDate).toEqual(new Date(d("2027-01-15").getTime() + 1));
    expect(quote(term(1), [legacy], "2026-10-01")).toEqual({ ok: false, reason: "1st Term 2026/2027 is already paid for." });
  });

  it("the full session credits the ₦40,000 paid", () => {
    expect(quote(session, [legacy], "2026-10-01")).toMatchObject({ ok: true, amount: 80_000, credit: 40_000 });
  });
});

describe("what a payment that has already succeeded covers", () => {
  it("is the term's calendar window", () => {
    expect(paidWindow(term(1), SESS, [], d("2026-10-15"))).toEqual({ startDate: d("2026-10-15"), endDate: eod("2026-12-31") });
    expect(paidWindow(session, SESS, [t1(40_000)], d("2026-10-15"))).toEqual({ startDate: d("2027-01-01"), endDate: eod("2027-08-31") });
  });

  it("if the term passed while paying (started 30 Dec, confirmed 2 Jan), it covers the next term instead", () => {
    expect(paidWindow(term(1), SESS, [], d("2027-01-02"))).toEqual({ startDate: d("2027-01-02"), endDate: eod("2027-04-30") });
  });

  it("if the same term was paid twice at once, the second payment covers the next term", () => {
    expect(paidWindow(term(1), SESS, [t1()], d("2026-10-15"))).toEqual({ startDate: d("2027-01-01"), endDate: eod("2027-04-30") });
  });
});

describe("coverage helpers", () => {
  it("coverage end is the latest end held, ignoring cancelled", () => {
    expect(coverageEnd([t1(), { ...t2(), status: "CANCELLED" }])).toEqual(eod("2026-12-31"));
    expect(coverageEnd([])).toBeNull();
  });

  it("new coverage starts the instant the old ends; if it has already ended, now", () => {
    expect(nextStart([t1()], d("2026-11-01"))).toEqual(d("2027-01-01"));
    expect(nextStart([t1()], d("2027-02-10"))).toEqual(d("2027-02-10"));
    expect(nextStart([], d("2026-09-01"))).toEqual(d("2026-09-01"));
  });
});

describe("what a brand-new school can start with (sign-up)", () => {
  const names = (now: string) => {
    const o = startingOffer(d(now));
    return { term: o.term && `${o.term.label} ${o.term.session}`, session: o.session?.session ?? null, termPrice: o.term?.quote.ok ? o.term.quote.amount : null, sessionPrice: o.session?.quote.ok ? o.session.quote.amount : null };
  };

  it("October: 1st Term at the registration price, or the full session", () => {
    expect(names("2026-10-15")).toEqual({ term: "1st Term 2026/2027", session: "2026/2027", termPrice: 40_000, sessionPrice: 120_000 });
  });

  it("January: 2nd Term, or the full session for the 2 terms left", () => {
    expect(names("2027-01-20")).toEqual({ term: "2nd Term 2026/2027", session: "2026/2027", termPrice: 40_000, sessionPrice: 80_000 });
  });

  it("May: 3rd Term only — too little of the session is left", () => {
    expect(names("2027-05-10")).toEqual({ term: "3rd Term 2026/2027", session: null, termPrice: 40_000, sessionPrice: null });
  });

  it("August break: next session's 1st Term, or its full session", () => {
    expect(names("2027-08-10")).toEqual({ term: "1st Term 2027/2028", session: "2027/2028", termPrice: 40_000, sessionPrice: 120_000 });
  });
});

describe("plan keys", () => {
  it("round-trip and reject junk", () => {
    for (const key of ["1", "2", "3", "SESSION"]) expect(planKey(planFromKey(key)!)).toBe(key);
    expect(planFromKey("4")).toBeNull();
    expect(planFromKey("abc")).toBeNull();
  });
});
