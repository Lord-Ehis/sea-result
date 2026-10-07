import { describe, expect, it } from "vitest";
import { eventLabel, explainProviderError, isRetryableEvent, maskRecipient, parseTestTarget, summarizeFailures, type FailedMessage } from "@/lib/owner-messages";

describe("isRetryableEvent", () => {
  it("only result notifications can be re-sent", () => {
    expect(isRetryableEvent("RESULT_PUBLISHED")).toBe(true);
    expect(isRetryableEvent("RESULT_AMENDED")).toBe(true);
    for (const e of ["PASSWORD_RESET", "ACCOUNT_CREATED", "PAYMENT_RECEIVED", "SUBSCRIPTION_REMINDER", ""]) expect(isRetryableEvent(e)).toBe(false);
  });
});

describe("maskRecipient", () => {
  it("keeps just enough of a phone number to recognise it", () => {
    expect(maskRecipient("+2348000000102")).toBe("+234•••••••102");
    expect(maskRecipient("+234 800 000 0102")).toBe("+234•••••••102");
  });
  it("keeps the first letter and the domain of an email", () => {
    expect(maskRecipient("ada.obi@gmail.com")).toBe("a•••@gmail.com");
  });
  it("hides short or odd values completely", () => {
    expect(maskRecipient("12345")).toBe("•••");
    expect(maskRecipient("")).toBe("•••");
  });
});

describe("summarizeFailures", () => {
  const rows: FailedMessage[] = [
    { schoolId: "b", channel: "SMS", event: "RESULT_PUBLISHED" },
    { schoolId: "b", channel: "SMS", event: "RESULT_PUBLISHED" },
    { schoolId: "b", channel: "EMAIL", event: "PASSWORD_RESET" },
    { schoolId: "a", channel: "EMAIL", event: "RESULT_AMENDED" },
  ];
  const s = summarizeFailures(rows);
  it("counts each school's failures by channel and by whether they can be retried", () => {
    expect(s[0]).toEqual({ schoolId: "b", total: 3, sms: 2, email: 1, retryable: 2, notRetryable: 1 });
    expect(s[1]).toEqual({ schoolId: "a", total: 1, sms: 0, email: 1, retryable: 1, notRetryable: 0 });
  });
  it("puts the school with the most failures first", () => {
    expect(s.map((x) => x.schoolId)).toEqual(["b", "a"]);
  });
  it("is empty when nothing failed", () => {
    expect(summarizeFailures([])).toEqual([]);
  });
});

describe("parseTestTarget", () => {
  it("accepts an email address, trimmed", () => {
    expect(parseTestTarget("EMAIL", "  me@example.com ")).toEqual({ ok: true, value: "me@example.com" });
  });
  it("rejects things that are not emails", () => {
    for (const bad of ["", "nope", "a@b", "a b@c.com"]) expect(parseTestTarget("EMAIL", bad).ok).toBe(false);
  });
  it("tidies a phone number to +digits", () => {
    expect(parseTestTarget("SMS", "+234 801 234 5678")).toEqual({ ok: true, value: "+2348012345678" });
    expect(parseTestTarget("SMS", "(234) 801-234-5678")).toEqual({ ok: true, value: "+2348012345678" });
  });
  it("rejects phone numbers that are too short, too long or contain letters", () => {
    for (const bad of ["080123", "+234801234567890123", "call me", "+234abc1234567"]) expect(parseTestTarget("SMS", bad).ok).toBe(false);
  });
});

describe("explainProviderError", () => {
  it("explains the sender ID not being approved", () => {
    expect(explainProviderError('Termii request failed (422): {"message":"SENDER_ID_NOT_APPROVED"}')).toMatch(/not approved this sender ID/);
  });
  it("explains Resend's unverified-domain limit", () => {
    expect(explainProviderError("Resend request failed (403): You can only send testing emails to your own email address")).toMatch(/verify/i);
  });
  it("explains missing keys, rejected keys and unreachable providers", () => {
    expect(explainProviderError("Email provider is not configured (EMAIL_API_KEY/EMAIL_FROM missing).")).toMatch(/Global settings/);
    expect(explainProviderError("Termii request failed (401): invalid api key")).toMatch(/rejected the key/);
    expect(explainProviderError("TypeError: fetch failed")).toMatch(/could not reach/i);
  });
  it("says nothing rather than guess at an unknown error", () => {
    expect(explainProviderError("Something strange happened")).toBeNull();
  });
});

describe("eventLabel", () => {
  it("reads naturally and falls back to the raw name", () => {
    expect(eventLabel("RESULT_PUBLISHED")).toBe("Result published");
    expect(eventLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});
