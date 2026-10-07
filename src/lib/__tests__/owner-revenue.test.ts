import { describe, expect, it } from "vitest";
import {
  csvCell,
  lastMonthKeys,
  latestPaymentBySchool,
  monthKey,
  renewalsDue,
  revenueByMonth,
  revenueByPeriod,
  revenueBySchool,
  toCsv,
  type PaidPayment,
  type RenewalSchool,
} from "@/lib/owner-revenue";

const d = (iso: string) => new Date(iso);
const now = d("2026-10-07T12:00:00Z");
const pay = (over: Partial<PaidPayment>): PaidPayment => ({
  amount: 40000,
  paidAt: d("2026-10-01T10:00:00Z"),
  schoolId: "s1",
  billingCycle: "PER_TERM",
  session: "2026/2027",
  termNumber: 1,
  isRegistration: false,
  ...over,
});

describe("months", () => {
  it("cuts months in UTC and lists the last N oldest-first", () => {
    expect(monthKey(d("2026-10-31T23:59:59Z"))).toBe("2026-10");
    expect(monthKey(d("2026-11-01T00:00:00Z"))).toBe("2026-11");
    expect(lastMonthKeys(now, 3)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(lastMonthKeys(d("2026-02-10T00:00:00Z"), 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("revenueByMonth", () => {
  const rows = revenueByMonth(
    [pay({ paidAt: d("2026-10-02T00:00:00Z") }), pay({ amount: 10000, paidAt: d("2026-10-05T00:00:00Z") }), pay({ amount: 120000, paidAt: d("2026-08-20T00:00:00Z") }), pay({ paidAt: d("2024-01-01T00:00:00Z") })],
    now,
    3,
  );
  it("totals each month and keeps empty months", () => {
    expect(rows.map((r) => [r.key, r.total, r.count])).toEqual([["2026-08", 120000, 1], ["2026-09", 0, 0], ["2026-10", 50000, 2]]);
  });
  it("ignores payments outside the window", () => {
    expect(rows.reduce((s, r) => s + r.count, 0)).toBe(3);
  });
});

describe("revenueByPeriod", () => {
  const rows = revenueByPeriod([
    pay({}),
    pay({ amount: 40000, termNumber: 2 }),
    pay({ amount: 120000, billingCycle: "FULL_SESSION", termNumber: null }),
    pay({ amount: 40000, session: "2025/2026", termNumber: 3 }),
    pay({ amount: 5000, session: null, termNumber: null, billingCycle: null }),
    pay({ amount: 7000, termNumber: null }),
  ]);
  it("labels what each payment was for, newest session first", () => {
    expect(rows.map((r) => r.label)).toEqual(["2026/2027 · Full session", "2026/2027 · 2nd Term", "2026/2027 · 1st Term", "2026/2027 · Term not recorded", "2025/2026 · 3rd Term", "Not labelled"]);
  });
  it("adds up correctly", () => {
    expect(rows.find((r) => r.label === "2026/2027 · Full session")).toMatchObject({ total: 120000, count: 1 });
    expect(rows.reduce((s, r) => s + r.total, 0)).toBe(252000);
  });
});

describe("revenueBySchool", () => {
  const names = new Map([["a", "Alpha"], ["b", "Beta"], ["c", "Gamma"]]);
  const rows = revenueBySchool(
    [
      pay({ schoolId: "a", amount: 60000 }),
      pay({ schoolId: "b", amount: 20000 }),
      pay({ schoolId: "b", amount: 20000, paidAt: d("2026-09-01T00:00:00Z") }),
      pay({ schoolId: "c", amount: 90000, paidAt: d("2025-01-01T00:00:00Z") }), // long ago: lifetime only
    ],
    names,
    now,
  );
  it("ranks by the last 12 months, then lifetime", () => {
    expect(rows.map((r) => r.name)).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(rows[0]).toMatchObject({ last12: 60000, lifetime: 60000 });
    expect(rows[2]).toMatchObject({ last12: 0, lifetime: 90000 });
  });
  it("gives each school's share of the last 12 months", () => {
    expect(rows.map((r) => r.sharePct)).toEqual([60, 40, 0]);
  });
  it("copes with no payments at all", () => {
    expect(revenueBySchool([], names, now)).toEqual([]);
  });
});

describe("latestPaymentBySchool", () => {
  it("keeps the most recent payment per school", () => {
    const latest = latestPaymentBySchool([pay({ schoolId: "a", amount: 1, paidAt: d("2026-01-01T00:00:00Z") }), pay({ schoolId: "a", amount: 2, paidAt: d("2026-06-01T00:00:00Z") }), pay({ schoolId: "b", amount: 3 })]);
    expect(latest.get("a")?.amount).toBe(2);
    expect(latest.get("b")?.amount).toBe(3);
  });
});

describe("renewalsDue", () => {
  const sub = (end: string, over: Partial<RenewalSchool["subscriptions"][number]> = {}) => ({ status: "ACTIVE" as const, startDate: d("2026-06-01T00:00:00Z"), endDate: d(end), billingCycle: "PER_TERM" as const, isComplimentary: false, ...over });
  const school = (id: string, subs: RenewalSchool["subscriptions"], status: RenewalSchool["status"] = "ACTIVE"): RenewalSchool => ({ id, name: `School ${id}`, status, subscriptions: subs });

  const r = renewalsDue(
    [
      school("soon", [sub("2026-10-20T12:00:00Z")]),
      school("sooner", [sub("2026-10-09T12:00:00Z")]),
      school("sixty", [sub("2026-11-26T12:00:00Z")]),
      school("ninety", [sub("2027-01-05T12:00:00Z")]),
      school("later", [sub("2027-03-01T12:00:00Z")]),
      school("grace", [sub("2026-10-04T12:00:00Z")]),
      school("lapsed", [sub("2026-08-01T12:00:00Z")]),
      school("renewed", [sub("2026-10-10T12:00:00Z"), sub("2027-02-10T12:00:00Z")]),
      school("free", [sub("2026-10-25T12:00:00Z", { isComplimentary: true })]),
      school("session", [sub("2026-10-15T12:00:00Z", { billingCycle: "FULL_SESSION" })]),
      school("never", []),
      school("suspended", [sub("2026-10-12T12:00:00Z")], "SUSPENDED"),
      school("cancelled", [sub("2026-10-12T12:00:00Z", { status: "CANCELLED" })]),
    ],
    now,
  );
  const ids = (rows: { schoolId: string }[]) => rows.map((x) => x.schoolId);

  it("puts each school in the window its coverage ends in", () => {
    expect(ids(r.next30)).toEqual(["sooner", "session", "soon", "free"]);
    expect(ids(r.next60)).toEqual(["sixty"]);
    expect(ids(r.next90)).toEqual(["ninety"]);
  });
  it("lists schools whose coverage has ended, most recently ended first", () => {
    expect(ids(r.ended)).toEqual(["grace", "lapsed"]);
    expect(r.ended.map((x) => x.state)).toEqual(["GRACE", "LAPSED"]);
  });
  it("leaves out schools that have already renewed, are far off, or were switched off", () => {
    const all = [...r.ended, ...r.next30, ...r.next60, ...r.next90].map((x) => x.schoolId);
    for (const gone of ["renewed", "later", "suspended"]) expect(all).not.toContain(gone);
  });
  it("counts schools that never subscribed (including one with only a cancelled plan) separately", () => {
    expect(r.neverSubscribed).toBe(2);
    expect(ids(r.ended)).not.toContain("never");
  });
  it("names the plan the school is on", () => {
    expect(r.next30.find((x) => x.schoolId === "free")?.plan).toBe("FREE");
    expect(r.next30.find((x) => x.schoolId === "session")?.plan).toBe("FULL_SESSION");
    expect(r.next30.find((x) => x.schoolId === "soon")?.plan).toBe("PER_TERM");
  });
});

describe("csv", () => {
  it("quotes cells that need it and doubles inner quotes", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("Smith, Jones")).toBe('"Smith, Jones"');
    expect(csvCell('The "Best" School')).toBe('"The ""Best"" School"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(40000)).toBe("40000");
    expect(csvCell(true)).toBe("true");
  });
  it("defuses text that would run as a spreadsheet formula, but leaves negative numbers alone", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csvCell("+234 school")).toBe("'+234 school");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell(-500)).toBe("-500");
  });
  it("builds a whole file with a header and CRLF line ends", () => {
    expect(toCsv(["a", "b"], [["x", 1], ["y,z", 2]])).toBe('a,b\r\nx,1\r\n"y,z",2\r\n');
  });
});
