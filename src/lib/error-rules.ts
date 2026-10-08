import { createHash } from "node:crypto";

// What counts as a server error worth recording, what makes two of them "the
// same", and when the owner is emailed. Pure, so each rule is unit-tested; the
// database and email parts live in error-capture.ts.

export const ALERT_EVERY_MINUTES = 60;
/** Across all errors: past this many alert emails in an hour, the rest wait for the Errors page. */
export const ALERT_EMAILS_PER_HOUR = 10;
export const MESSAGE_MAX = 400;
export const STACK_MAX = 1800;
/** The most distinct errors kept at once, and how long an untouched one is kept. */
export const MAX_ERROR_ROWS = 2000;
export const RETENTION_DAYS = 60;

// Next.js throws these on purpose to redirect, show "not found" and so on: they are control flow, not failures.
const CONTROL_FLOW_DIGESTS = ["NEXT_REDIRECT", "NEXT_NOT_FOUND", "NEXT_HTTP_ERROR_FALLBACK", "DYNAMIC_SERVER_USAGE", "BAILOUT_TO_CLIENT_SIDE_RENDERING", "NEXT_PRERENDER_INTERRUPTED"];

type ErrorLike = { name?: unknown; message?: unknown; stack?: unknown; digest?: unknown; type?: unknown };

const asError = (err: unknown): ErrorLike => (err && typeof err === "object" ? (err as ErrorLike) : { message: String(err) });

export function shouldIgnore(err: unknown): boolean {
  const e = asError(err);
  const digest = typeof e.digest === "string" ? e.digest : "";
  const message = typeof e.message === "string" ? e.message : "";
  if (CONTROL_FLOW_DIGESTS.some((d) => digest.startsWith(d) || message === d)) return true;
  // A wrong password is not a server fault.
  if (e.type === "CredentialsSignin" || e.name === "CredentialsSignin") return true;
  return false;
}

/**
 * Takes personal details and secrets out of an error's text before it is stored
 * or emailed. Database errors can quote the values being saved (a person's
 * email, a password hash), so those patterns are blanked wherever they appear.
 */
export function redact(text: string): string {
  return text
    .replace(/\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}/g, "[hash]")
    .replace(/[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@/g, "[address-with-login]@")
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]")
    .replace(/\+?\d[\d\s().-]{8,}\d/g, "[number]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[token]");
}

/**
 * The part of a message worth keeping. Prisma errors open with a code frame that
 * quotes the data being written, so only their first line and last line (the
 * actual reason) are kept; anything else keeps its first line.
 */
export function summarise(message: unknown): string {
  const lines = (typeof message === "string" ? message : "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";
  if (lines.length > 1 && /invocation/i.test(lines[0])) return `${lines[0]} … ${lines[lines.length - 1]}`;
  return lines[0];
}

/** Only the "at …" lines: the first lines of a stack repeat the message, with whatever data it quotes. */
export function cleanStack(stack: unknown): string | null {
  if (typeof stack !== "string") return null;
  const frames = stack
    .split("\n")
    .filter((l) => /^\s+at\s/.test(l))
    .slice(0, 12);
  return frames.length ? frames.join("\n").slice(0, STACK_MAX) : null;
}

/** One line, ids and numbers blurred, so "student 123 not found" and "student 456 not found" are one problem. */
export function tidyMessage(message: unknown): string {
  return redact(summarise(message))
    .replace(/\b[a-z0-9]{24,}\b/gi, "#")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

export function fingerprintFor(err: unknown, route: string): string {
  const e = asError(err);
  const name = typeof e.name === "string" ? e.name : "Error";
  return createHash("sha256").update(`${name}|${tidyMessage(e.message)}|${route}`).digest("hex").slice(0, 32);
}

export type CapturedError = { name: string; message: string; stack: string | null; fingerprint: string; route: string; routeType: string };

/** What gets stored: trimmed, and tied to the route pattern, never to the real URL. */
export function describeError(err: unknown, context: { routePath?: unknown; routeType?: unknown }): CapturedError | null {
  if (shouldIgnore(err)) return null;
  const e = asError(err);
  const route = typeof context.routePath === "string" && context.routePath ? context.routePath.slice(0, 200) : "unknown";
  const routeType = typeof context.routeType === "string" ? context.routeType : "unknown";
  return {
    name: (typeof e.name === "string" ? e.name : "Error").slice(0, 100),
    message: redact(summarise(e.message) || "No message").slice(0, MESSAGE_MAX),
    stack: cleanStack(e.stack),
    fingerprint: fingerprintFor(err, route),
    route,
    routeType,
  };
}

/** Email on the first sighting (or the first after it was marked fixed), then at most once an hour per error. */
export function isAlertDue(lastAlertedAt: Date | null, now: Date): boolean {
  if (!lastAlertedAt) return true;
  return now.getTime() - lastAlertedAt.getTime() >= ALERT_EVERY_MINUTES * 60_000;
}

export function alertEmail(error: CapturedError, count: number, baseUrl: string): { subject: string; text: string } {
  return {
    subject: `[SEA] Error on ${error.route}`,
    text: [
      "Something went wrong on the site.",
      "",
      `Where: ${error.route} (${error.routeType})`,
      `What: ${error.name}: ${error.message}`,
      `Times seen: ${count}`,
      "",
      `Details and the full list: ${baseUrl.replace(/\/$/, "")}/owner/errors`,
      "",
      "You will not be emailed about this same error again for an hour.",
    ].join("\n"),
  };
}

export const ROUTE_TYPE_LABEL: Record<string, string> = {
  render: "Page",
  route: "API route",
  action: "Form or button",
  middleware: "Sign-in check",
};
