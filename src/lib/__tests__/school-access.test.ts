import { describe, expect, it } from "vitest";
import { addDays, addMonths } from "@/lib/add-months";
import { GRACE_DAYS, decideAccess, dueMilestones, resolveSchoolAccess, type SubscriptionWindow } from "@/lib/school-access";

const d = (iso: string) => new Date(iso);
const sub = (start: string, end: string, status: SubscriptionWindow["status"] = "ACTIVE"): SubscriptionWindow => ({ status, startDate: d(start), endDate: d(end) });

describe("addMonths", () => {
  it("adds whole months", () => {
    expect(addMonths(d("2026-09-14T10:00:00Z"), 4).toISOString()).toBe("2027-01-14T10:00:00.000Z");
    expect(addMonths(d("2026-09-14T10:00:00Z"), 12).toISOString()).toBe("2027-09-14T10:00:00.000Z");
  });
  it("clamps to the end of a shorter month instead of overflowing", () => {
    expect(addMonths(d("2026-10-31T00:00:00Z"), 4).toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(addMonths(d("2027-10-31T00:00:00Z"), 4).toISOString().slice(0, 10)).toBe("2028-02-29"); // leap year
    expect(addMonths(d("2026-08-31T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2026-09-30");
  });
  it("adds days", () => {
    expect(addDays(d("2026-12-30T00:00:00Z"), 7).toISOString().slice(0, 10)).toBe("2027-01-06");
  });
});

describe("resolving a school's access", () => {
  const term = [sub("2026-09-14T00:00:00Z", "2027-01-14T00:00:00Z")];
  const resolve = (now: string, subs = term, status: "ACTIVE" | "SUSPENDED" | "PENDING_DELETION" = "ACTIVE") => resolveSchoolAccess({ status, subscriptions: subs, now: d(now) });

  it("is active while covered, including on the last instant", () => {
    expect(resolve("2026-10-01T00:00:00Z").state).toBe("ACTIVE");
    expect(resolve("2027-01-14T00:00:00Z").state).toBe("ACTIVE");
  });

  it("gives a 7-day grace after the end, then lapses", () => {
    expect(resolve("2027-01-14T00:00:01Z").state).toBe("GRACE");
    expect(resolve("2027-01-21T00:00:00Z").state).toBe("GRACE"); // day 7
    expect(resolve("2027-01-21T00:00:01Z").state).toBe("LAPSED"); // day 8
    expect(GRACE_DAYS).toBe(7);
  });

  it("counts whole days left", () => {
    expect(resolve("2027-01-01T00:00:00Z").daysLeft).toBe(13);
    expect(resolve("2027-01-14T12:00:00Z").daysLeft).toBe(-1);
  });

  it("a school that never subscribed is lapsed, with nothing to count from", () => {
    const a = resolve("2026-10-01T00:00:00Z", []);
    expect(a.state).toBe("LAPSED");
    expect(a.coverageEndsAt).toBeNull();
    expect(a.daysLeft).toBeNull();
  });

  it("stacked subscriptions cover until the latest end", () => {
    const stacked = [...term, sub("2027-01-14T00:00:00Z", "2027-05-14T00:00:00Z")];
    expect(resolve("2027-03-01T00:00:00Z", stacked).state).toBe("ACTIVE");
    expect(resolve("2027-03-01T00:00:00Z", stacked).coverageEndsAt?.toISOString().slice(0, 10)).toBe("2027-05-14");
  });

  it("ignores cancelled subscriptions but counts expired ones as the past", () => {
    const cancelled = [...term, sub("2027-01-14T00:00:00Z", "2027-05-14T00:00:00Z", "CANCELLED")];
    expect(resolve("2027-03-01T00:00:00Z", cancelled).state).toBe("LAPSED");
    const expired = [sub("2026-01-01T00:00:00Z", "2026-05-01T00:00:00Z", "EXPIRED")];
    expect(resolve("2026-09-01T00:00:00Z", expired).state).toBe("LAPSED");
  });

  it("suspension wins over an active subscription", () => {
    expect(resolve("2026-10-01T00:00:00Z", term, "SUSPENDED").state).toBe("SUSPENDED");
  });

  it("a school waiting on a deletion decision keeps working as before", () => {
    expect(resolve("2026-10-01T00:00:00Z", term, "PENDING_DELETION").state).toBe("ACTIVE");
  });
});

describe("who may do what", () => {
  it("never restricts parents or the platform owner", () => {
    for (const state of ["ACTIVE", "GRACE", "LAPSED", "SUSPENDED"] as const) {
      expect(decideAccess("PARENT", state, "/parent/dashboard")).toBe("allow");
      expect(decideAccess("PLATFORM_OWNER", state, "/owner/schools")).toBe("allow");
    }
  });
  it("lets staff work while active or in grace", () => {
    for (const state of ["ACTIVE", "GRACE"] as const) {
      expect(decideAccess("SCHOOL_ADMIN", state, "/admin/students")).toBe("allow");
      expect(decideAccess("TEACHER", state, "/teacher/classes")).toBe("allow");
    }
  });
  it("locks staff out when suspended", () => {
    expect(decideAccess("SCHOOL_ADMIN", "SUSPENDED", "/admin/dashboard")).toBe("blocked-suspended");
    expect(decideAccess("SCHOOL_ADMIN", "SUSPENDED", "/admin/billing")).toBe("blocked-suspended");
    expect(decideAccess("TEACHER", "SUSPENDED", "/teacher/classes")).toBe("blocked-suspended");
  });
  it("when lapsed, admins can only renew and teachers can do nothing", () => {
    expect(decideAccess("SCHOOL_ADMIN", "LAPSED", "/admin/billing")).toBe("allow");
    expect(decideAccess("SCHOOL_ADMIN", "LAPSED", "/admin/billing/callback")).toBe("allow");
    expect(decideAccess("SCHOOL_ADMIN", "LAPSED", "/admin/students")).toBe("billing-only");
    expect(decideAccess("SCHOOL_ADMIN", "LAPSED", "/admin/billingfake")).toBe("billing-only");
    expect(decideAccess("TEACHER", "LAPSED", "/teacher/classes")).toBe("blocked-lapsed");
  });
});

describe("reminder milestones", () => {
  const subs = [sub("2026-09-14T00:00:00Z", "2027-01-14T00:00:00Z")];
  const at = (now: string) => {
    const access = resolveSchoolAccess({ status: "ACTIVE", subscriptions: subs, now: d(now) });
    return dueMilestones(access, d(now));
  };
  it("stays quiet well before the end", () => {
    expect(at("2026-11-01T00:00:00Z")).toEqual([]);
  });
  it("sends the 14, 7 and 1 day reminders as each window is reached", () => {
    expect(at("2026-12-31T00:00:00Z")).toEqual(["T-14"]); // 14 days left
    expect(at("2027-01-05T00:00:00Z")).toEqual(["T-14"]); // 9 days left: still the 14-day window
    expect(at("2027-01-07T00:00:00Z")).toEqual(["T-7"]);
    expect(at("2027-01-13T00:00:00Z")).toEqual(["T-1"]);
  });
  it("announces the end (grace) and then the lock", () => {
    expect(at("2027-01-16T00:00:00Z")).toEqual(["ENDED"]);
    expect(at("2027-01-22T00:00:00Z")).toEqual(["LOCKED"]);
  });
  it("says nothing for a school that never subscribed or is suspended", () => {
    const none = resolveSchoolAccess({ status: "ACTIVE", subscriptions: [], now: d("2027-01-22T00:00:00Z") });
    expect(dueMilestones(none, d("2027-01-22T00:00:00Z"))).toEqual([]);
    const suspended = resolveSchoolAccess({ status: "SUSPENDED", subscriptions: subs, now: d("2027-01-13T00:00:00Z") });
    expect(dueMilestones(suspended, d("2027-01-13T00:00:00Z"))).toEqual([]);
  });
});
