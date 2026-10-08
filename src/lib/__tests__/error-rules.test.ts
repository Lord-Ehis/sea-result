import { describe, expect, it } from "vitest";
import { ALERT_EVERY_MINUTES, MESSAGE_MAX, STACK_MAX, alertEmail, describeError, fingerprintFor, isAlertDue, shouldIgnore, tidyMessage } from "@/lib/error-rules";

describe("shouldIgnore", () => {
  it("skips the errors Next.js throws on purpose", () => {
    expect(shouldIgnore(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" }))).toBe(true);
    expect(shouldIgnore(Object.assign(new Error("x"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }))).toBe(true);
    expect(shouldIgnore(Object.assign(new Error("x"), { digest: "DYNAMIC_SERVER_USAGE" }))).toBe(true);
    expect(shouldIgnore(new Error("NEXT_NOT_FOUND"))).toBe(true);
  });

  it("skips a wrong password, but keeps real failures", () => {
    expect(shouldIgnore(Object.assign(new Error("x"), { type: "CredentialsSignin" }))).toBe(true);
    expect(shouldIgnore(new TypeError("Cannot read properties of undefined"))).toBe(false);
    expect(shouldIgnore("a thrown string")).toBe(false);
  });
});

describe("fingerprints", () => {
  it("treats the same problem with different ids and numbers as one error", () => {
    expect(tidyMessage("Student cmu8ig76q0009hov5hq8smm1t not found in batch 42")).toBe("Student # not found in batch #");
    const a = fingerprintFor(new Error("Student cmu8ig76q0009hov5hq8smm1t not found"), "/admin/students");
    const b = fingerprintFor(new Error("Student cmxxxxxxxxxxxxxxxxxxxxxxx not found"), "/admin/students");
    expect(a).toBe(b);
  });

  it("separates different messages, error types and routes", () => {
    const base = fingerprintFor(new Error("boom"), "/a");
    expect(fingerprintFor(new Error("bang"), "/a")).not.toBe(base);
    expect(fingerprintFor(new Error("boom"), "/b")).not.toBe(base);
    expect(fingerprintFor(new TypeError("boom"), "/a")).not.toBe(base);
  });

  it("only looks at the first line of the message", () => {
    expect(fingerprintFor(new Error("boom\nat line 1"), "/a")).toBe(fingerprintFor(new Error("boom\nat line 99"), "/a"));
  });
});

describe("describeError", () => {
  it("records the route pattern, never the real address", () => {
    const e = describeError(new Error("boom"), { routePath: "/admin/results/[batchId]", routeType: "render" });
    expect(e).toMatchObject({ name: "Error", message: "boom", route: "/admin/results/[batchId]", routeType: "render" });
    expect(e?.fingerprint).toMatch(/^[0-9a-f]{32}$/);
  });

  it("trims long messages and stacks, and copes with odd input", () => {
    const long = new Error("x".repeat(5000));
    long.stack = "s".repeat(9000);
    const e = describeError(long, { routePath: "/p", routeType: "route" })!;
    expect(e.message).toHaveLength(MESSAGE_MAX);
    expect(e.stack).toHaveLength(STACK_MAX);
    expect(describeError("plain text", {})).toMatchObject({ message: "plain text", route: "unknown", routeType: "unknown" });
    expect(describeError(new Error(""), {})!.message).toBe("No message");
  });

  it("returns nothing for control-flow errors", () => {
    expect(describeError(Object.assign(new Error("x"), { digest: "NEXT_REDIRECT" }), {})).toBeNull();
  });
});

describe("isAlertDue", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  it("alerts the first time, then waits an hour", () => {
    expect(isAlertDue(null, now)).toBe(true);
    expect(isAlertDue(new Date(now.getTime() - (ALERT_EVERY_MINUTES - 1) * 60_000), now)).toBe(false);
    expect(isAlertDue(new Date(now.getTime() - ALERT_EVERY_MINUTES * 60_000), now)).toBe(true);
  });
});

describe("alertEmail", () => {
  it("names the place, the problem and where to look, with no trailing-slash trouble", () => {
    const e = describeError(new Error("boom"), { routePath: "/admin/students", routeType: "action" })!;
    const mail = alertEmail(e, 3, "https://example.com/");
    expect(mail.subject).toBe("[SEA] Error on /admin/students");
    expect(mail.text).toContain("Error: boom");
    expect(mail.text).toContain("Times seen: 3");
    expect(mail.text).toContain("https://example.com/owner/errors");
  });
});
