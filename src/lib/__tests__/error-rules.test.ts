import { describe, expect, it } from "vitest";
import { ALERT_EVERY_MINUTES, MESSAGE_MAX, STACK_MAX, alertEmail, cleanStack, describeError, fingerprintFor, isAlertDue, redact, shouldIgnore, summarise, tidyMessage } from "@/lib/error-rules";

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
    const long = new Error("word ".repeat(1000));
    long.stack = "Error: boom\n" + "    at somewhere (file.ts:1:1)\n".repeat(400);
    const e = describeError(long, { routePath: "/p", routeType: "route" })!;
    expect(e.message).toHaveLength(MESSAGE_MAX);
    expect(e.stack!.split("\n")).toHaveLength(12); // the first twelve frames only
    expect(e.stack!.length).toBeLessThanOrEqual(STACK_MAX);
    expect(e.stack).not.toContain("boom");
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

describe("redact", () => {
  it("blanks emails, password hashes, phone numbers, long tokens and logins inside addresses", () => {
    const hash = "$2b$10$" + "a".repeat(53);
    const out = redact(`user ada@example.com hash ${hash} phone +234 801 234 5678 token ${"A1b2".repeat(10)} at postgresql://postgres:secret@host:6543/db`);
    expect(out).not.toMatch(/ada@example|\$2b\$|234 801|A1b2A1b2|secret/);
    expect(out).toContain("[email]");
    expect(out).toContain("[hash]");
    expect(out).toContain("[number]");
    expect(out).toContain("[token]");
    expect(out).toContain("[address-with-login]@host");
  });

  it("leaves ordinary text and short ids alone", () => {
    expect(redact("Student cmu8ig76q0009hov5hq8smm1t not found in batch 42")).toBe("Student cmu8ig76q0009hov5hq8smm1t not found in batch 42");
  });
});

describe("summarise and cleanStack", () => {
  it("keeps the first and last lines of a database error, not the data between", () => {
    const m = "\nInvalid `prisma.user.create()` invocation:\n\n{ data: { email: 'x' } }\n\nUnique constraint failed on the fields: (`email`)";
    expect(summarise(m)).toBe("Invalid `prisma.user.create()` invocation: … Unique constraint failed on the fields: (`email`)");
    expect(summarise("plain\nsecond line")).toBe("plain");
    expect(summarise(undefined)).toBe("");
  });

  it("gives different database errors on one page different fingerprints", () => {
    const a = new Error("\nInvalid `prisma.user.create()` invocation:\n\nUnique constraint failed on the fields: (`email`)");
    const b = new Error("\nInvalid `prisma.user.create()` invocation:\n\nForeign key constraint failed");
    expect(fingerprintFor(a, "/x")).not.toBe(fingerprintFor(b, "/x"));
  });

  it("keeps only stack frames, never the message lines above them", () => {
    const stack = "Error: contains ada@example.com\n    at one (a.ts:1:1)\n    at two (b.ts:2:2)";
    expect(cleanStack(stack)).toBe("    at one (a.ts:1:1)\n    at two (b.ts:2:2)");
    expect(cleanStack("no frames here")).toBeNull();
    expect(cleanStack(undefined)).toBeNull();
  });
});
