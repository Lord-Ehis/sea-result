import { createHash } from "node:crypto";

// What counts as a server error worth recording, what makes two of them "the
// same", and when the owner is emailed. Pure, so each rule is unit-tested; the
// database and email parts live in error-capture.ts.

export const ALERT_EVERY_MINUTES = 60;
/** Across all errors: past this many alert emails in an hour, the rest wait for the Errors page. */
export const ALERT_EMAILS_PER_HOUR = 10;
export const MESSAGE_MAX = 400;
export const STACK_MAX = 1800;

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

/** One line, ids and numbers blurred, so "student 123 not found" and "student 456 not found" are one problem. */
export function tidyMessage(message: unknown): string {
  const text = typeof message === "string" ? message : "";
  return text.split("\n")[0].replace(/\b[a-z0-9]{24,}\b/gi, "#").replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
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
    message: (typeof e.message === "string" && e.message ? e.message : "No message").slice(0, MESSAGE_MAX),
    stack: typeof e.stack === "string" ? e.stack.slice(0, STACK_MAX) : null,
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
