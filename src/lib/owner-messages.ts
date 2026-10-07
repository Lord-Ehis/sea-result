// What the platform owner's Messages page needs to know about SMS and email
// delivery. Pure — no database or network — so the rules (what can be retried,
// how a recipient is masked, what a test destination must look like, and what a
// provider's error actually means) are unit-tested.

export type MessageChannel = "SMS" | "EMAIL";

/** Only result notifications are re-sent: anything else (a password link, say) carries a link that has since expired. */
export const RETRYABLE_EVENTS = ["RESULT_PUBLISHED", "RESULT_AMENDED"] as const;
export const isRetryableEvent = (event: string) => (RETRYABLE_EVENTS as readonly string[]).includes(event);

/** The most one click will retry, so a request never runs for minutes. */
export const RETRY_BATCH_LIMIT = 200;

export const EVENT_LABEL: Record<string, string> = {
  RESULT_PUBLISHED: "Result published",
  RESULT_AMENDED: "Result corrected",
  ACCOUNT_CREATED: "Account invite",
  PASSWORD_RESET: "Password link",
  PAYMENT_RECEIVED: "Payment received",
  SUBSCRIPTION_REMINDER: "Subscription reminder",
};
export const eventLabel = (event: string) => EVENT_LABEL[event] ?? event;

/**
 * Enough of a phone number or email to recognise it, not enough to read it out:
 * "+2348000000102" -> "+234•••••102", "ada.obi@gmail.com" -> "a•••@gmail.com".
 */
export function maskRecipient(value: string): string {
  const text = value.trim();
  const at = text.lastIndexOf("@");
  if (at > 0) return `${text[0]}•••${text.slice(at)}`;
  const compact = text.replace(/[\s()-]/g, "");
  if (compact.length <= 7) return "•••";
  return `${compact.slice(0, 4)}${"•".repeat(compact.length - 7)}${compact.slice(-3)}`;
}

export type FailedMessage = { schoolId: string; channel: MessageChannel; event: string };
export type SchoolFailures = { schoolId: string; total: number; sms: number; email: number; retryable: number; notRetryable: number };

/** Failed messages counted per school, the school with the most failures first. */
export function summarizeFailures(rows: FailedMessage[]): SchoolFailures[] {
  const bySchool = new Map<string, SchoolFailures>();
  for (const r of rows) {
    const s = bySchool.get(r.schoolId) ?? { schoolId: r.schoolId, total: 0, sms: 0, email: 0, retryable: 0, notRetryable: 0 };
    s.total += 1;
    if (r.channel === "SMS") s.sms += 1;
    else s.email += 1;
    if (isRetryableEvent(r.event)) s.retryable += 1;
    else s.notRetryable += 1;
    bySchool.set(r.schoolId, s);
  }
  return [...bySchool.values()].sort((a, b) => b.total - a.total || a.schoolId.localeCompare(b.schoolId));
}

/** A tidy, checked destination for a test message, or the reason it can't be used. */
export function parseTestTarget(channel: MessageChannel, raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const text = raw.trim();
  if (channel === "EMAIL") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) && text.length <= 254 ? { ok: true, value: text } : { ok: false, error: "Enter a valid email address." };
  }
  const compact = text.replace(/[\s()-]/g, "");
  const digits = compact.replace(/^\+/, "");
  if (!/^\d{10,15}$/.test(digits) || !/^\+?\d+$/.test(compact)) return { ok: false, error: "Enter a phone number with the country code, for example +2348012345678." };
  return { ok: true, value: compact.startsWith("+") ? compact : `+${compact}` };
}

/** A plain-language hint for the errors our providers actually return; null when there is nothing useful to add. */
export function explainProviderError(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("not configured")) return "No keys are saved for this provider yet. Add them in Global settings.";
  if (m.includes("sender_id_not_approved") || m.includes("sender id") && m.includes("not")) return "The SMS provider has not approved this sender ID yet. Approval usually takes 1 to 3 working days; until then no SMS will be delivered.";
  if (m.includes("resend") && (m.includes("domain") || m.includes("only send testing emails") || m.includes("verify a domain") || m.includes("(403)")))
    return "Resend will only deliver to your own address until a sending domain is verified. Verify your domain in Resend, then set the sender address to use it.";
  if (m.includes("(401)") || m.includes("invalid api key") || m.includes("unauthorized") || m.includes("invalid_api_key")) return "The provider rejected the key. Re-enter it in Global settings.";
  if (m.includes("(429)") || m.includes("rate limit")) return "The provider is limiting how fast we send. Wait a few minutes and try again.";
  if (m.includes("fetch failed") || m.includes("enotfound") || m.includes("econnrefused") || m.includes("etimedout")) return "We could not reach the provider. Check the base URL in Global settings, or try again shortly.";
  return null;
}
