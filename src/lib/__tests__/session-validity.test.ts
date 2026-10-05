import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique } } }));

import { checkSession, forgetUserSession, isSessionStillValid } from "../session-validity";
import { emailChange } from "../account-events";

describe("isSessionStillValid", () => {
  const row = { email: "ada@example.com", isActive: true };
  it("accepts the account the token was issued for", () => {
    expect(isSessionStillValid("ada@example.com", row)).toBe(true);
  });
  it("ends the session when the sign-in email was replaced", () => {
    expect(isSessionStillValid("ada@old.example", row)).toBe(false);
  });
  it("ends the session when the account is switched off or gone", () => {
    expect(isSessionStillValid("ada@example.com", { ...row, isActive: false })).toBe(false);
    expect(isSessionStillValid("ada@example.com", null)).toBe(false);
  });
  it("does not end a token that carries no email", () => {
    expect(isSessionStillValid(undefined, row)).toBe(true);
  });
});

describe("checkSession", () => {
  beforeEach(() => {
    findUnique.mockReset();
    forgetUserSession("u1");
  });

  it("asks the database once, then uses the short-lived copy", async () => {
    findUnique.mockResolvedValue({ email: "a@x.com", isActive: true });
    expect(await checkSession("u1", "a@x.com")).toBe(true);
    expect(await checkSession("u1", "a@x.com")).toBe(true);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("sees a change at once after forgetUserSession", async () => {
    findUnique.mockResolvedValueOnce({ email: "a@x.com", isActive: true });
    expect(await checkSession("u1", "a@x.com")).toBe(true);
    forgetUserSession("u1");
    findUnique.mockResolvedValueOnce({ email: "b@x.com", isActive: true });
    expect(await checkSession("u1", "a@x.com")).toBe(false);
  });

  it("keeps people signed in if the database check itself fails", async () => {
    findUnique.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await checkSession("u1", "a@x.com")).toBe(true);
  });
});

describe("emailChange", () => {
  it("reads old and new addresses from the event", () => {
    expect(emailChange({ from: "a@x.com", to: "b@x.com" })).toEqual({ from: "a@x.com", to: "b@x.com" });
  });
  it("tolerates missing or malformed metadata", () => {
    expect(emailChange(null)).toEqual({ from: "—", to: "—" });
    expect(emailChange([1])).toEqual({ from: "—", to: "—" });
  });
});
