import { describe, expect, it } from "vitest";
import {
  dailyJobVerdict,
  deliveryVerdict,
  emailSenderVerdict,
  freshness,
  paystackKeyMode,
  paystackKeyVerdict,
  publicAddressVerdict,
  resendDomainVerdict,
  secretsVerdict,
  senderDomain,
  summarise,
  termiiSenderVerdict,
  webhookVerdict,
} from "../readiness-rules";

describe("Paystack key", () => {
  it("tells live from test by prefix, and never returns the key", () => {
    expect(paystackKeyMode("sk_live_abc123")).toBe("live");
    expect(paystackKeyMode("sk_test_abc123")).toBe("test");
    expect(paystackKeyMode("")).toBe("missing");
    expect(paystackKeyMode(undefined)).toBe("missing");
    expect(paystackKeyMode("pk_live_abc")).toBe("unrecognised");
    for (const mode of ["live", "test", "missing", "unrecognised"] as const) expect(JSON.stringify(paystackKeyVerdict(mode))).not.toMatch(/sk_(live|test)_[A-Za-z0-9]/);
  });

  it("only live is ready", () => {
    expect(paystackKeyVerdict("live").status).toBe("ready");
    expect(paystackKeyVerdict("test").status).toBe("attention");
    expect(paystackKeyVerdict("missing").status).toBe("attention");
    expect(paystackKeyVerdict("unrecognised").status).toBe("unknown");
  });

  it("the test-mode message says what to do", () => {
    expect(paystackKeyVerdict("test").fix).toMatch(/sk_live_/);
  });
});

describe("payment notifications (webhook)", () => {
  it("never seen needs attention and names the URL to add", () => {
    const v = webhookVerdict("never", null, "https://example.com/api/webhooks/paystack");
    expect(v.status).toBe("attention");
    expect(v.fix).toContain("https://example.com/api/webhooks/paystack");
  });

  it("seen is ready, however long ago", () => {
    expect(webhookVerdict("fresh", new Date("2026-09-20T10:00:00Z"), "u").status).toBe("ready");
    expect(webhookVerdict("stale", new Date("2026-01-20T10:00:00Z"), "u").status).toBe("ready");
  });
});

describe("public address", () => {
  it("needs a real https domain of its own", () => {
    expect(publicAddressVerdict("https://sophie-ea.app").status).toBe("ready");
    expect(publicAddressVerdict("https://sea-result.vercel.app").status).toBe("attention");
    expect(publicAddressVerdict("http://sophie-ea.app").status).toBe("attention");
    expect(publicAddressVerdict("http://localhost:3000").status).toBe("attention");
    expect(publicAddressVerdict("not a url").status).toBe("attention");
    expect(publicAddressVerdict(undefined).status).toBe("attention");
  });
});

describe("email sender", () => {
  it("finds the domain in either address form", () => {
    expect(senderDomain("Sophie <noreply@Sophie-EA.app>")).toBe("sophie-ea.app");
    expect(senderDomain("noreply@sophie-ea.app")).toBe("sophie-ea.app");
    expect(senderDomain("onboarding@resend.dev")).toBe("resend.dev");
    expect(senderDomain("nonsense")).toBeNull();
    expect(senderDomain(undefined)).toBeNull();
  });

  it("Resend's test address needs attention; your own domain is fine", () => {
    expect(emailSenderVerdict("onboarding@resend.dev").status).toBe("attention");
    expect(emailSenderVerdict("Sophie <noreply@sophie-ea.app>").status).toBe("ready");
    expect(emailSenderVerdict(undefined).status).toBe("attention");
  });
});

describe("Resend domain check", () => {
  const domain = "sophie-ea.app";

  it("a send-only key can't look up domains, so it says so rather than guessing", () => {
    const v = resendDomainVerdict(401, { statusCode: 401, name: "restricted_api_key", message: "This API key is restricted to only send emails" }, domain);
    expect(v.status).toBe("unknown");
    expect(v.fix).toContain(domain);
  });

  it("verified is ready; pending or missing needs attention", () => {
    expect(resendDomainVerdict(200, { data: [{ name: "Sophie-EA.app", status: "verified" }] }, domain).status).toBe("ready");
    expect(resendDomainVerdict(200, { data: [{ name: domain, status: "pending" }] }, domain)).toMatchObject({ status: "attention", detail: expect.stringContaining("pending") });
    expect(resendDomainVerdict(200, { data: [{ name: "other.com", status: "verified" }] }, domain).status).toBe("attention");
    expect(resendDomainVerdict(200, { data: [] }, domain).status).toBe("attention");
  });

  it("nothing to check while the sender is still the test address; odd replies are 'can't check'", () => {
    expect(resendDomainVerdict(200, { data: [] }, "resend.dev").status).toBe("unknown");
    expect(resendDomainVerdict(200, { data: [] }, null).status).toBe("unknown");
    expect(resendDomainVerdict(500, null, domain).status).toBe("unknown");
    expect(resendDomainVerdict(200, { unexpected: true }, domain).status).toBe("unknown");
  });
});

describe("Termii sender ID", () => {
  it("an empty list means none is registered (what a fresh account returns)", () => {
    const v = termiiSenderVerdict(200, { content: [], empty: true, totalElements: 0 }, "SEA");
    expect(v.status).toBe("attention");
    expect(v.detail).toMatch(/No sender ID is registered/);
  });

  it("approved, waiting, and other statuses", () => {
    expect(termiiSenderVerdict(200, { content: [{ sender_id: "SEA", status: "active" }] }, "sea").status).toBe("ready");
    expect(termiiSenderVerdict(200, { content: [{ sender_id: "SEA", status: "unblock" }] }, "SEA").status).toBe("ready");
    expect(termiiSenderVerdict(200, { content: [{ sender_id: "SEA", status: "pending" }] }, "SEA")).toMatchObject({ status: "attention", detail: expect.stringContaining("waiting") });
    expect(termiiSenderVerdict(200, { content: [{ sender_id: "SEA", status: "blocked" }] }, "SEA")).toMatchObject({ status: "attention", detail: expect.stringContaining("blocked") });
  });

  it("a sender ID that isn't in the list says what is", () => {
    const v = termiiSenderVerdict(200, { content: [{ sender_id: "Other", status: "active" }] }, "SEA");
    expect(v.status).toBe("attention");
    expect(v.detail).toContain("Other");
  });

  it("odd replies are 'can't check', never a false 'ready'", () => {
    expect(termiiSenderVerdict(500, null, "SEA").status).toBe("unknown");
    expect(termiiSenderVerdict(200, { message: "ok" }, "SEA").status).toBe("unknown");
    expect(termiiSenderVerdict(401, { content: [{ sender_id: "SEA", status: "active" }] }, "SEA").status).toBe("unknown");
  });
});

describe("delivery health", () => {
  it("judges by failures in the last 30 days", () => {
    expect(deliveryVerdict("email", 0, 0).status).toBe("unknown");
    expect(deliveryVerdict("email", 12, 0).status).toBe("ready");
    expect(deliveryVerdict("SMS", 9, 3)).toMatchObject({ status: "attention", detail: "3 of 12 SMS messages in the last 30 days failed." });
  });
});

describe("the daily job", () => {
  const now = new Date("2026-09-23T08:00:00Z");
  it("is fresh within 26 hours, stale after, never if it hasn't run", () => {
    expect(freshness(new Date("2026-09-23T06:00:10Z"), now, 26)).toBe("fresh");
    expect(freshness(new Date("2026-09-22T06:00:10Z"), now, 26)).toBe("fresh");
    expect(freshness(new Date("2026-09-21T06:00:10Z"), now, 26)).toBe("stale");
    expect(freshness(null, now, 26)).toBe("never");
  });

  it("says what to do when it hasn't run", () => {
    expect(dailyJobVerdict("fresh", now).status).toBe("ready");
    expect(dailyJobVerdict("never", null).fix).toMatch(/06:00 UTC/);
    expect(dailyJobVerdict("stale", new Date("2026-09-19T06:00:00Z")).detail).toContain("2026-09-19");
  });
});

describe("secrets", () => {
  it("lists what is missing, by name only", () => {
    expect(secretsVerdict({ AUTH_SECRET: true, CRON_SECRET: true }).status).toBe("ready");
    const v = secretsVerdict({ AUTH_SECRET: true, CRON_SECRET: false, PROVIDER_CONFIG_KEY: false });
    expect(v).toMatchObject({ status: "attention", detail: "Missing: CRON_SECRET, PROVIDER_CONFIG_KEY." });
  });
});

describe("roll-up", () => {
  it("counts ready, attention and can't-check", () => {
    expect(summarise([{ status: "ready" }, { status: "ready" }, { status: "attention" }, { status: "unknown" }])).toEqual({ ready: 2, attention: 1, unknown: 1, total: 4 });
    expect(summarise([])).toEqual({ ready: 0, attention: 0, unknown: 0, total: 0 });
  });
});
