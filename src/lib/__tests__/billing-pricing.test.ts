import { describe, expect, it } from "vitest";
import {
  REGISTRATION_DISCOUNT,
  SESSION_PRICE,
  TERM_PRICE,
  coverageEnd,
  coverageWindow,
  nextStart,
  parseSession,
  planFromKey,
  planKey,
  quoteSubscription,
  registrationDiscountAvailable,
  sessionCredit,
  sessionOptions,
  type HeldSubscription,
  type Plan,
} from "../billing-pricing";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const term = (n: 1 | 2 | 3): Plan => ({ kind: "TERM", termNumber: n });
const session: Plan = { kind: "SESSION" };

function heldTerm(n: 1 | 2 | 3, start: string, end: string, amount = TERM_PRICE, sess = "2026/2027"): HeldSubscription {
  return { billingCycle: "PER_TERM", termNumber: n, session: sess, amount, status: "ACTIVE", startDate: d(start), endDate: d(end) };
}

describe("prices", () => {
  it("has the agreed numbers", () => {
    expect(TERM_PRICE).toBe(50_000);
    expect(REGISTRATION_DISCOUNT).toBe(10_000);
    expect(SESSION_PRICE).toBe(120_000);
  });
});

describe("registration discount", () => {
  it("applies only to the registration payment, and only until something has been paid", () => {
    expect(registrationDiscountAvailable([{ isRegistration: true, status: "PENDING" }])).toBe(true);
    expect(registrationDiscountAvailable([{ isRegistration: true, status: "FAILED" }])).toBe(true);
    expect(registrationDiscountAvailable([{ isRegistration: true, status: "SUCCESS" }])).toBe(false);
    // registered, never paid, then some other payment later succeeded
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
    const now = d("2026-09-01");
    const reg = quoteSubscription({ plan: term(1), session: "2026/2027", held: [], now, registration: true });
    const later = quoteSubscription({ plan: term(1), session: "2026/2027", held: [], now, registration: false });
    expect(reg).toMatchObject({ ok: true, amount: 40_000, registrationDiscount: 10_000, listPrice: 50_000 });
    expect(later).toMatchObject({ ok: true, amount: 50_000, registrationDiscount: 0 });
  });

  it("never discounts the full session, even when registering", () => {
    const q = quoteSubscription({ plan: session, session: "2026/2027", held: [], now: d("2026-09-01"), registration: true });
    expect(q).toMatchObject({ ok: true, amount: 120_000, registrationDiscount: 0, credit: 0 });
  });
});

describe("annual after terms", () => {
  const now = d("2026-10-15");

  it("credits ₦40,000 paid for 1st Term: pay ₦80,000, covered to 12 months after the term began", () => {
    const held = [heldTerm(1, "2026-09-01", "2027-01-01", 40_000)];
    const q = quoteSubscription({ plan: session, session: "2026/2027", held, now, registration: false });
    expect(q).toMatchObject({ ok: true, amount: 80_000, credit: 40_000, listPrice: 120_000 });
    if (q.ok) {
      expect(q.startDate).toEqual(d("2027-01-01")); // picks up where the term ends
      expect(q.endDate).toEqual(d("2027-09-01")); // session start + 12 months
    }
  });

  it("credits ₦50,000 paid for a term: pay ₦70,000", () => {
    const held = [heldTerm(1, "2026-09-01", "2027-01-01", 50_000)];
    expect(quoteSubscription({ plan: session, session: "2026/2027", held, now, registration: false })).toMatchObject({ ok: true, amount: 70_000, credit: 50_000 });
  });

  it("credits every term paid for that session", () => {
    const held = [heldTerm(1, "2026-09-01", "2027-01-01", 40_000), heldTerm(2, "2027-01-01", "2027-05-01", 50_000)];
    expect(quoteSubscription({ plan: session, session: "2026/2027", held, now, registration: false })).toMatchObject({ ok: true, amount: 30_000, credit: 90_000 });
  });

  it("charges the full ₦120,000 when nothing was paid for that session", () => {
    const held = [heldTerm(1, "2025-09-01", "2026-01-01", 50_000, "2025/2026")];
    expect(quoteSubscription({ plan: session, session: "2026/2027", held, now, registration: false })).toMatchObject({ ok: true, amount: 120_000, credit: 0 });
  });

  it("refuses once the session is already covered to its end", () => {
    const held = [heldTerm(1, "2026-09-01", "2027-01-01"), heldTerm(2, "2027-01-01", "2027-05-01"), heldTerm(3, "2027-05-01", "2027-09-01")];
    const q = quoteSubscription({ plan: session, session: "2026/2027", held, now, registration: false });
    expect(q.ok).toBe(false);
  });

  it("refuses a session that is already over", () => {
    const held = [heldTerm(1, "2025-09-01", "2026-01-01", 50_000, "2025/2026")];
    const q = quoteSubscription({ plan: session, session: "2025/2026", held, now, registration: false });
    expect(q).toEqual({ ok: false, reason: "The 2025/2026 session has already ended." });
  });

  it("refuses paying the full session twice", () => {
    const held: HeldSubscription[] = [{ billingCycle: "FULL_SESSION", termNumber: null, session: "2026/2027", amount: 120_000, status: "ACTIVE", startDate: d("2026-09-01"), endDate: d("2027-09-01") }];
    expect(quoteSubscription({ plan: session, session: "2026/2027", held, now, registration: false }).ok).toBe(false);
  });
});

describe("duplicate terms", () => {
  const now = d("2026-10-15");

  it("refuses the same term for the same session, even after it has expired", () => {
    const expired: HeldSubscription = { ...heldTerm(1, "2026-09-01", "2027-01-01"), status: "EXPIRED" };
    expect(quoteSubscription({ plan: term(1), session: "2026/2027", held: [expired], now, registration: false })).toEqual({
      ok: false,
      reason: "1st Term 2026/2027 is already paid for.",
    });
  });

  it("allows the same term in a different session, and a different term in the same session", () => {
    const held = [heldTerm(1, "2026-09-01", "2027-01-01")];
    expect(quoteSubscription({ plan: term(1), session: "2027/2028", held, now, registration: false }).ok).toBe(true);
    expect(quoteSubscription({ plan: term(2), session: "2026/2027", held, now, registration: false }).ok).toBe(true);
  });

  it("refuses any term once the session is paid in full", () => {
    const held: HeldSubscription[] = [{ billingCycle: "FULL_SESSION", termNumber: null, session: "2026/2027", amount: 120_000, status: "ACTIVE", startDate: d("2026-09-01"), endDate: d("2027-09-01") }];
    expect(quoteSubscription({ plan: term(2), session: "2026/2027", held, now, registration: false }).ok).toBe(false);
  });

  it("a cancelled subscription does not count", () => {
    const cancelled: HeldSubscription = { ...heldTerm(1, "2026-09-01", "2027-01-01"), status: "CANCELLED" };
    expect(quoteSubscription({ plan: term(1), session: "2026/2027", held: [cancelled], now, registration: false }).ok).toBe(true);
  });

  it("rejects a session label that is not a real session", () => {
    for (const bad of ["2026", "2026/2028", "26/27", "", "Term 1, 2026/2027"]) {
      expect(quoteSubscription({ plan: term(1), session: bad, held: [], now, registration: false }).ok).toBe(false);
    }
  });
});

describe("complimentary access", () => {
  const complimentary: HeldSubscription = {
    billingCycle: "FULL_SESSION",
    termNumber: null,
    session: "2026/2027",
    amount: 0,
    status: "ACTIVE",
    startDate: d("2026-09-21"),
    endDate: d("2026-12-31"),
    isComplimentary: true,
  };

  it("does not block buying a term, and is not credited", () => {
    expect(quoteSubscription({ plan: term(2), session: "2026/2027", held: [complimentary], now: d("2026-10-01"), registration: false }).ok).toBe(true);
    expect(sessionCredit([complimentary], "2026/2027")).toBe(0);
  });

  it("still counts as coverage, so a paid term begins where it ends", () => {
    const q = quoteSubscription({ plan: term(2), session: "2026/2027", held: [complimentary], now: d("2026-10-01"), registration: false });
    if (q.ok) expect(q.startDate).toEqual(d("2026-12-31"));
  });
});

describe("coverage windows", () => {
  it("a term lasts 4 months from where current coverage ends (stacking)", () => {
    const held = [heldTerm(1, "2026-09-01", "2027-01-01")];
    expect(coverageWindow(term(2), "2026/2027", held, d("2026-11-01"))).toEqual({ startDate: d("2027-01-01"), endDate: d("2027-05-01") });
  });

  it("paying early loses no days; paying late starts today", () => {
    const held = [heldTerm(1, "2026-09-01", "2027-01-01")];
    expect(nextStart(held, d("2026-12-20"))).toEqual(d("2027-01-01"));
    expect(nextStart(held, d("2027-02-10"))).toEqual(d("2027-02-10"));
    expect(nextStart([], d("2026-09-01"))).toEqual(d("2026-09-01"));
  });

  it("clamps at month ends: 31 Oct + 4 months is 28 Feb, not 3 Mar", () => {
    expect(coverageWindow(term(1), "2026/2027", [], d("2026-10-31")).endDate).toEqual(d("2027-02-28"));
  });

  it("a fresh full session runs 12 months from when it starts", () => {
    expect(coverageWindow(session, "2026/2027", [], d("2026-09-01"))).toEqual({ startDate: d("2026-09-01"), endDate: d("2027-09-01") });
  });

  it("coverage end is the latest end held, ignoring cancelled", () => {
    const held = [heldTerm(1, "2026-09-01", "2027-01-01"), { ...heldTerm(2, "2027-01-01", "2027-05-01"), status: "CANCELLED" as const }];
    expect(coverageEnd(held)).toEqual(d("2027-01-01"));
    expect(coverageEnd([])).toBeNull();
  });
});

describe("sessions and plan keys", () => {
  it("parses only well-formed consecutive sessions", () => {
    expect(parseSession("2026/2027")).toBe(2026);
    expect(parseSession(" 2026/2027 ")).toBe(2026);
    expect(parseSession("2026/2027/x")).toBeNull();
    expect(parseSession("2026/2026")).toBeNull();
  });

  it("offers the current and next session (the year turns over in August)", () => {
    expect(sessionOptions(d("2026-09-21"))).toEqual(["2026/2027", "2027/2028"]);
    expect(sessionOptions(d("2027-03-01"))).toEqual(["2026/2027", "2027/2028"]);
    expect(sessionOptions(d("2026-07-31"))).toEqual(["2025/2026", "2026/2027"]);
  });

  it("round-trips plan keys and rejects junk", () => {
    for (const key of ["1", "2", "3", "SESSION"]) expect(planKey(planFromKey(key)!)).toBe(key);
    expect(planFromKey("4")).toBeNull();
    expect(planFromKey("abc")).toBeNull();
  });
});
