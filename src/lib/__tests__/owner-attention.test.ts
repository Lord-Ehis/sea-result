import { describe, expect, it } from "vitest";
import type { SubscriptionWindow } from "@/lib/school-access";
import { cronLooksStale, isPaymentStuck, onboardingGaps, relativeDays, subscriptionAttention } from "@/lib/owner-attention";

const d = (iso: string) => new Date(iso);
const now = d("2026-10-07T12:00:00Z");
const sub = (end: string, status: SubscriptionWindow["status"] = "ACTIVE"): SubscriptionWindow => ({ status, startDate: d("2026-06-01T00:00:00Z"), endDate: d(end) });
const school = (id: string, subs: SubscriptionWindow[], status: "ACTIVE" | "SUSPENDED" | "PENDING_DELETION" = "ACTIVE") => ({ id, name: `School ${id}`, status, subscriptions: subs });

describe("subscriptionAttention", () => {
  const result = subscriptionAttention(
    [
      school("healthy", [sub("2027-01-01T00:00:00Z")]),
      school("soon", [sub("2026-10-17T00:00:00Z")]),
      school("sooner", [sub("2026-10-09T00:00:00Z")]),
      school("grace", [sub("2026-10-04T00:00:00Z")]),
      school("lapsed", [sub("2026-09-01T00:00:00Z")]),
      school("never", []),
      school("suspended", [sub("2026-09-01T00:00:00Z")], "SUSPENDED"),
      school("cancelled-only", [sub("2027-01-01T00:00:00Z", "CANCELLED")]),
    ],
    now,
  );

  it("flags schools about to run out, most urgent first", () => {
    expect(result.expiringSoon.map((s) => s.schoolId)).toEqual(["sooner", "soon"]);
  });
  it("separates the grace period from being locked out", () => {
    expect(result.grace.map((s) => s.schoolId)).toEqual(["grace"]);
    expect(result.lapsed.map((s) => s.schoolId).sort()).toEqual(["cancelled-only", "lapsed", "never"]);
  });
  it("lists the school that never subscribed first among the locked out", () => {
    expect(result.lapsed[0].schoolId).toBe("never");
    expect(result.lapsed[0].daysLeft).toBeNull();
  });
  it("leaves healthy and deliberately suspended schools out", () => {
    const all = [...result.lapsed, ...result.grace, ...result.expiringSoon].map((s) => s.schoolId);
    expect(all).not.toContain("healthy");
    expect(all).not.toContain("suspended");
  });
  it("treats exactly 14 days left as expiring and 15 as fine", () => {
    const edge = subscriptionAttention([school("fourteen", [sub("2026-10-21T12:00:00Z")]), school("fifteen", [sub("2026-10-22T12:00:00Z")])], now);
    expect(edge.expiringSoon.map((s) => s.schoolId)).toEqual(["fourteen"]);
  });
});

describe("onboardingGaps", () => {
  const base = { status: "ACTIVE" as const, createdAt: d("2026-09-01T00:00:00Z"), students: 5, teachers: 2, templates: 1 };
  it("is quiet for a school that has everything", () => {
    expect(onboardingGaps(base, now)).toBeNull();
  });
  it("names what is missing", () => {
    expect(onboardingGaps({ ...base, students: 0, templates: 0 }, now)).toEqual(["No students", "No result template"]);
    expect(onboardingGaps({ ...base, students: 0, teachers: 0, templates: 0 }, now)).toEqual(["No students", "No teachers", "No result template"]);
  });
  it("gives a new school a few days before judging it", () => {
    expect(onboardingGaps({ ...base, students: 0, createdAt: d("2026-10-06T00:00:00Z") }, now)).toBeNull();
    expect(onboardingGaps({ ...base, students: 0, createdAt: d("2026-10-04T00:00:00Z") }, now)).toEqual(["No students"]);
  });
  it("ignores suspended and pending-deletion schools", () => {
    expect(onboardingGaps({ ...base, students: 0, status: "SUSPENDED" }, now)).toBeNull();
    expect(onboardingGaps({ ...base, students: 0, status: "PENDING_DELETION" }, now)).toBeNull();
  });
});

describe("isPaymentStuck", () => {
  it("only pending payments between an hour and a week old", () => {
    expect(isPaymentStuck({ status: "PENDING", createdAt: d("2026-10-07T10:00:00Z") }, now)).toBe(true);
    expect(isPaymentStuck({ status: "PENDING", createdAt: d("2026-10-07T11:30:00Z") }, now)).toBe(false);
    expect(isPaymentStuck({ status: "PENDING", createdAt: d("2026-09-01T00:00:00Z") }, now)).toBe(false); // abandoned long ago
    expect(isPaymentStuck({ status: "SUCCESS", createdAt: d("2026-10-01T00:00:00Z") }, now)).toBe(false);
    expect(isPaymentStuck({ status: "FAILED", createdAt: d("2026-10-01T00:00:00Z") }, now)).toBe(false);
  });
});

describe("cronLooksStale", () => {
  it("is stale when it never ran or hasn't in a day and a half", () => {
    expect(cronLooksStale(null, now)).toBe(true);
    expect(cronLooksStale(d("2026-10-05T00:00:00Z"), now)).toBe(true);
    expect(cronLooksStale(d("2026-10-07T03:00:00Z"), now)).toBe(false);
  });
});

describe("relativeDays", () => {
  it("reads naturally", () => {
    expect(relativeDays(null)).toBe("never subscribed");
    expect(relativeDays(0)).toBe("today");
    expect(relativeDays(1)).toBe("tomorrow");
    expect(relativeDays(5)).toBe("in 5 days");
    expect(relativeDays(-1)).toBe("yesterday");
    expect(relativeDays(-9)).toBe("9 days ago");
  });
});
