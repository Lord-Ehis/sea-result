import { describe, expect, it } from "vitest";
import {
  describeEmailChange,
  describePlatformEvent,
  describePricingChange,
  filterAndSort,
  isAuditCategory,
  paginate,
  parseComplimentaryNote,
  parseDay,
  type AuditEntry,
} from "@/lib/owner-audit";

const d = (iso: string) => new Date(iso);
const entry = (id: string, at: string, category: AuditEntry["category"] = "SCHOOLS"): AuditEntry => ({ id, at: d(at), category, title: id, detail: null, actor: null, schoolId: null });

describe("describePlatformEvent", () => {
  it("files each action under the right heading", () => {
    expect(describePlatformEvent("SCHOOL_SUSPENDED", null).category).toBe("SCHOOLS");
    expect(describePlatformEvent("SCHOOL_REACTIVATED", null).category).toBe("SCHOOLS");
    expect(describePlatformEvent("PROVIDER_CONFIGURED", { provider: "PAYSTACK" }).category).toBe("SETTINGS");
    expect(describePlatformEvent("PROVIDER_CLEARED", { provider: "SMS_TERMII" }).category).toBe("SETTINGS");
    expect(describePlatformEvent("PASSWORD_LINK_SENT", {}).category).toBe("ACCOUNTS");
  });
  it("names the provider, and never claims to log the keys", () => {
    const e = describePlatformEvent("PROVIDER_CONFIGURED", { provider: "EMAIL_RESEND" });
    expect(e.title).toBe("Resend (email) settings saved");
    expect(e.detail).toMatch(/never logged/);
  });
  it("copes with missing or odd metadata", () => {
    expect(describePlatformEvent("PROVIDER_CLEARED", null).title).toBe("a provider settings removed");
    expect(describePlatformEvent("PROVIDER_CLEARED", ["x"]).category).toBe("SETTINGS");
  });
  it("says so when the password email did not go out", () => {
    expect(describePlatformEvent("PASSWORD_LINK_SENT", { delivered: false }).detail).toMatch(/could not be sent/);
    expect(describePlatformEvent("PASSWORD_LINK_SENT", { delivered: true }).detail).toMatch(/emailed/);
  });
});

describe("describePricingChange", () => {
  it("lists only what changed", () => {
    const before = { termPrice: 40000, registrationDiscount: 5000, sessionDiscountPercent: 20 };
    expect(describePricingChange(before, { ...before, termPrice: 45000 })).toBe("Term price ₦40,000 → ₦45,000");
    expect(describePricingChange(before, { termPrice: 45000, registrationDiscount: 0, sessionDiscountPercent: 25 })).toBe(
      "Term price ₦40,000 → ₦45,000; New-school discount ₦5,000 → ₦0; Full-session discount 20% → 25%",
    );
  });
  it("handles a re-save with nothing different", () => {
    const same = { termPrice: 40000, registrationDiscount: 5000, sessionDiscountPercent: 20 };
    expect(describePricingChange(same, same)).toBe("Prices re-saved with no change");
  });
});

describe("describeEmailChange", () => {
  it("shows the account and both addresses", () => {
    expect(describeEmailChange("Ada Obi", { from: "a@old.example", to: "a@new.example" })).toBe("Ada Obi: a@old.example → a@new.example");
    expect(describeEmailChange("Ada Obi", null)).toBe("Ada Obi: — → —");
  });
});

describe("filterAndSort", () => {
  const all = [entry("a", "2026-10-01T10:00:00Z", "SCHOOLS"), entry("b", "2026-10-05T10:00:00Z", "BILLING"), entry("c", "2026-10-03T10:00:00Z", "SCHOOLS")];
  it("puts the newest first", () => {
    expect(filterAndSort(all, {}).map((e) => e.id)).toEqual(["b", "c", "a"]);
  });
  it("filters by category", () => {
    expect(filterAndSort(all, { category: "SCHOOLS" }).map((e) => e.id)).toEqual(["c", "a"]);
  });
  it("filters by date range, inclusive at both ends", () => {
    expect(filterAndSort(all, { from: d("2026-10-03T10:00:00Z"), to: d("2026-10-05T10:00:00Z") }).map((e) => e.id)).toEqual(["b", "c"]);
  });
  it("does not change the list it was given", () => {
    const copy = [...all];
    filterAndSort(all, {});
    expect(all).toEqual(copy);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 120 }, (_, i) => i);
  it("returns one page at a time", () => {
    const p = paginate(items, 2, 50);
    expect(p.items[0]).toBe(50);
    expect(p.items).toHaveLength(50);
    expect(p.pages).toBe(3);
    expect(p.total).toBe(120);
  });
  it("clamps a page number that is out of range or not a number", () => {
    expect(paginate(items, 99, 50).page).toBe(3);
    expect(paginate(items, 0, 50).page).toBe(1);
    expect(paginate(items, Number.NaN, 50).page).toBe(1);
  });
  it("copes with an empty list", () => {
    expect(paginate([], 1, 50)).toEqual({ items: [], page: 1, pages: 1, total: 0 });
  });
});

describe("parseDay / isAuditCategory", () => {
  it("covers the whole day at each end", () => {
    expect(parseDay("2026-10-07", false)?.toISOString()).toBe("2026-10-07T00:00:00.000Z");
    expect(parseDay("2026-10-07", true)?.toISOString()).toBe("2026-10-07T23:59:59.999Z");
  });
  it("ignores anything that is not a date", () => {
    expect(parseDay("yesterday", false)).toBeUndefined();
    expect(parseDay("2026-13-45", false)).toBeUndefined();
    expect(parseDay(undefined, true)).toBeUndefined();
  });
  it("only accepts the known categories", () => {
    expect(isAuditCategory("BILLING")).toBe(true);
    expect(isAuditCategory("nonsense")).toBe(false);
    expect(isAuditCategory(undefined)).toBe(false);
  });
});

describe("parseComplimentaryNote", () => {
  it("separates the reason from who granted it", () => {
    expect(parseComplimentaryNote("Complimentary access: Pilot school for 2026/2027 (granted by platform owner cmu123abc)")).toEqual({
      reason: "Pilot school for 2026/2027",
      ownerId: "cmu123abc",
    });
  });
  it("copes with notes in another shape", () => {
    expect(parseComplimentaryNote("Just a plain note")).toEqual({ reason: "Just a plain note", ownerId: null });
    expect(parseComplimentaryNote(null)).toEqual({ reason: "No reason given", ownerId: null });
  });
});
