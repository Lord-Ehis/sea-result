import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

// Two-step sign-in with an authenticator app (RFC 6238 TOTP: HMAC-SHA1, 6
// digits, 30-second steps — what Google Authenticator, Microsoft Authenticator,
// Authy and 1Password all speak). Pure apart from the clock and randomness,
// both of which can be passed in so the rules are unit-tested.

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Steps either side of "now" that still count, to forgive a phone clock that is a little off. */
export const TOTP_WINDOW = 1;
export const RECOVERY_CODE_COUNT = 10;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const index = BASE32.indexOf(ch);
    if (index < 0) throw new Error("Not a valid base32 secret.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new 160-bit secret, as the base32 text an authenticator app expects. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The code the app shows for a given 30-second step. */
export function totpAtStep(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const binary = ((hmac[offset] & 127) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export const stepAt = (now: Date) => Math.floor(now.getTime() / 1000 / TOTP_STEP_SECONDS);

const sameText = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * The step a code was valid for, or null. A step at or before `lastUsedStep`
 * is refused, so a code that was already accepted (or one that was watched
 * over a shoulder a moment ago) can't be used a second time.
 */
export function verifyTotp(secret: string, code: string, now: Date, lastUsedStep: number | null): number | null {
  const digits = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(digits)) return null;
  const current = stepAt(now);
  let matched: number | null = null;
  // Check every step in the window (no early exit) so timing doesn't reveal which one was close.
  for (let step = current - TOTP_WINDOW; step <= current + TOTP_WINDOW; step++) {
    if (sameText(totpAtStep(secret, step), digits) && (lastUsedStep === null || step > lastUsedStep)) matched = step;
  }
  return matched;
}

/** What the authenticator app scans: the account label and issuer travel with the secret. */
export function otpauthUri(secret: string, accountEmail: string, issuer = "SEA"): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountEmail)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

// ---- Recovery codes ------------------------------------------------------
// One-time codes for a lost phone. Letters and digits without look-alikes
// (no 0/O, 1/I/L), shown as XXXXX-XXXXX. Only a hash is stored. The codes carry
// about 50 bits, which a plain SHA-256 would not protect if the database leaked
// (they could be guessed offline), so they are hashed with HMAC-SHA256 under the
// server's secret key: stolen hashes alone are worthless.

const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const chars = Array.from({ length: 10 }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join("");
    return `${chars.slice(0, 5)}-${chars.slice(5)}`;
  });
}

/** Typed any way (case, spaces, with or without the dash) it compares the same. */
export const normaliseRecoveryCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

function recoveryKey(): Buffer {
  const raw = process.env.PROVIDER_CONFIG_KEY;
  if (!raw) throw new Error("PROVIDER_CONFIG_KEY is not configured.");
  return Buffer.from(raw, "base64");
}

export const hashRecoveryCode = (code: string) => createHmac("sha256", recoveryKey()).update(`recovery-code:${normaliseRecoveryCode(code)}`).digest("hex");

/** How codes were hashed before the server key was added; still accepted so an owner who already set up two-step isn't locked out. */
export const legacyHashRecoveryCode = (code: string) => createHash("sha256").update(normaliseRecoveryCode(code)).digest("hex");

/** A recovery code looks like 10 letters/digits (a 6-digit app code never does). */
export const looksLikeRecoveryCode = (input: string) => normaliseRecoveryCode(input).length === 10;
