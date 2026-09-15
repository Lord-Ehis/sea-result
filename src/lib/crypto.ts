import crypto from "crypto";

function getKey() {
  const raw = process.env.PROVIDER_CONFIG_KEY;
  if (!raw) throw new Error("PROVIDER_CONFIG_KEY is not configured.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("PROVIDER_CONFIG_KEY must decode to 32 bytes.");
  return key;
}

// AES-256-GCM, output packed as iv(12) + authTag(16) + ciphertext, base64.
export function encryptJson(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(value), "utf8")), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptJson<T>(encoded: string): T {
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
