import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  looksLikeRecoveryCode,
  normaliseRecoveryCode,
  otpauthUri,
  stepAt,
  totpAtStep,
  verifyTotp,
} from "@/lib/totp";

// RFC 6238 appendix B: the shared secret is the ASCII text 12345678901234567890.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));
const at = (seconds: number) => new Date(seconds * 1000);

describe("TOTP (RFC 6238)", () => {
  it("matches the published test vectors", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(totpAtStep(RFC_SECRET, stepAt(at(59)))).toBe("287082");
    expect(totpAtStep(RFC_SECRET, stepAt(at(1111111109)))).toBe("081804");
    expect(totpAtStep(RFC_SECRET, stepAt(at(1234567890)))).toBe("005924");
    expect(totpAtStep(RFC_SECRET, stepAt(at(2000000000)))).toBe("279037");
  });

  it("round-trips base32 and makes a 160-bit secret", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
    expect(base32Decode("gezd gnbv-GY3T").length).toBe(7);
    expect(() => base32Decode("not*valid")).toThrow();
  });

  it("accepts the current code and one step either side, but nothing further", () => {
    const now = at(1_000_000_000);
    const step = stepAt(now);
    expect(verifyTotp(RFC_SECRET, totpAtStep(RFC_SECRET, step), now, null)).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpAtStep(RFC_SECRET, step - 1), now, null)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpAtStep(RFC_SECRET, step + 1), now, null)).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, totpAtStep(RFC_SECRET, step - 2), now, null)).toBeNull();
    expect(verifyTotp(RFC_SECRET, totpAtStep(RFC_SECRET, step + 2), now, null)).toBeNull();
  });

  it("refuses a code from a step that was already used", () => {
    const now = at(1_000_000_000);
    const step = stepAt(now);
    const code = totpAtStep(RFC_SECRET, step);
    expect(verifyTotp(RFC_SECRET, code, now, step)).toBeNull();
    expect(verifyTotp(RFC_SECRET, code, now, step - 1)).toBe(step);
  });

  it("ignores spaces and rejects anything that is not six digits", () => {
    const now = at(1_000_000_000);
    const code = totpAtStep(RFC_SECRET, stepAt(now));
    expect(verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, now, null)).not.toBeNull();
    expect(verifyTotp(RFC_SECRET, "12345", now, null)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "abcdef", now, null)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "", now, null)).toBeNull();
  });

  it("builds the address an authenticator app scans", () => {
    expect(otpauthUri("ABC234", "owner@example.com")).toBe("otpauth://totp/SEA:owner%40example.com?secret=ABC234&issuer=SEA&algorithm=SHA1&digits=6&period=30");
  });
});

describe("recovery codes", () => {
  it("makes ten distinct XXXXX-XXXXX codes without look-alike characters", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/);
  });

  it("compares however the code was typed, and stores only a hash", () => {
    expect(normaliseRecoveryCode(" abcde-fgh23 ")).toBe("ABCDEFGH23");
    expect(hashRecoveryCode("abcde-fgh23")).toBe(hashRecoveryCode("ABCDEFGH23"));
    expect(hashRecoveryCode("ABCDE-FGH23")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("tells a recovery code from an app code", () => {
    expect(looksLikeRecoveryCode("ABCDE-FGH23")).toBe(true);
    expect(looksLikeRecoveryCode("123456")).toBe(false);
    expect(looksLikeRecoveryCode("123 456")).toBe(false);
  });
});
