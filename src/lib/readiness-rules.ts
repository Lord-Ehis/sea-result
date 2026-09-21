// The rules behind the owner's Go-live page: given what we can see (a key's
// prefix, an API's reply, a timestamp), decide whether each thing is ready.
// Pure functions - no network, no database, never a secret in the output - so
// they are easy to test. src/lib/readiness.ts gathers the facts and calls these.

export type CheckStatus = "ready" | "attention" | "unknown";
export type CheckGroup = "Payments" | "Email" | "SMS" | "Platform" | "Legal";

export type Check = {
  id: string;
  group: CheckGroup;
  title: string;
  status: CheckStatus;
  /** What we found, in plain words. */
  detail: string;
  /** What to do about it (shown when it isn't ready). */
  fix?: string;
};

type Verdict = { status: CheckStatus; detail: string; fix?: string };

// ─── Paystack ────────────────────────────────────────────────────────────────

export type KeyMode = "live" | "test" | "missing" | "unrecognised";

/** Test or live, judged from the key's prefix alone. The key itself is never returned. */
export function paystackKeyMode(secret: string | null | undefined): KeyMode {
  if (!secret) return "missing";
  if (secret.startsWith("sk_live_")) return "live";
  if (secret.startsWith("sk_test_")) return "test";
  return "unrecognised";
}

export function paystackKeyVerdict(mode: KeyMode): Verdict {
  switch (mode) {
    case "live":
      return { status: "ready", detail: "Live keys are in use, so real payments can be taken." };
    case "test":
      return {
        status: "attention",
        detail: "Paystack is in test mode - no real money moves.",
        fix: "Once Paystack has activated your business, copy the live secret key (it starts sk_live_) and paste it into Global settings under Paystack.",
      };
    case "missing":
      return { status: "attention", detail: "No Paystack key is set, so nobody can pay.", fix: "Add the Paystack secret key in Global settings." };
    default:
      return { status: "unknown", detail: "The Paystack key doesn't look like a normal Paystack secret key.", fix: "Check the key in Global settings." };
  }
}

export function webhookVerdict(freshness: Freshness, lastAt: Date | null, url: string): Verdict {
  if (freshness === "never") {
    return {
      status: "attention",
      detail: "No payment notification from Paystack has ever reached us.",
      fix: `In the Paystack dashboard open Settings > API Keys & Webhooks and set the Webhook URL to ${url}. Then make a payment to confirm it arrives.`,
    };
  }
  return { status: "ready", detail: `Paystack payment notifications reach us (last one ${lastAt ? lastAt.toISOString().slice(0, 10) : "recently"}, test or live).` };
}

// ─── Public address ──────────────────────────────────────────────────────────

export function publicAddressVerdict(url: string | null | undefined): Verdict {
  if (!url) return { status: "attention", detail: "The site's public address (NEXTAUTH_URL) isn't set.", fix: "Set NEXTAUTH_URL in Vercel to the public https address." };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { status: "attention", detail: "The site's public address (NEXTAUTH_URL) isn't a valid address.", fix: "Set NEXTAUTH_URL in Vercel to the public https address." };
  }
  if (parsed.hostname === "localhost" || parsed.hostname.endsWith(".local")) {
    return { status: "attention", detail: "The public address points at a local machine.", fix: "Set NEXTAUTH_URL in Vercel to the public https address." };
  }
  if (parsed.protocol !== "https:") return { status: "attention", detail: "The public address isn't https.", fix: "Use an https address so passwords and results are encrypted." };
  if (parsed.hostname.endsWith(".vercel.app")) {
    return {
      status: "attention",
      detail: `The site is still on its free Vercel address (${parsed.hostname}).`,
      fix: "Register your own domain, attach it in Vercel, and set NEXTAUTH_URL to it (see docs/GO-LIVE.md).",
    };
  }
  return { status: "ready", detail: `The site is served at ${parsed.hostname} over https.` };
}

// ─── Email (Resend) ──────────────────────────────────────────────────────────

/** The domain of a from-address written as "Name <a@b.com>" or "a@b.com". */
export function senderDomain(from: string | null | undefined): string | null {
  if (!from) return null;
  const inside = /<([^>]+)>/.exec(from)?.[1] ?? from;
  const at = inside.lastIndexOf("@");
  if (at < 0) return null;
  const domain = inside.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

export function emailSenderVerdict(from: string | null | undefined): Verdict {
  const domain = senderDomain(from);
  if (!domain) return { status: "attention", detail: "No email sender address is set.", fix: "Set the sender address in Global settings under Email (Resend)." };
  if (domain === "resend.dev") {
    return {
      status: "attention",
      detail: "Emails are sent from Resend's test address, which only delivers to your own Resend account - real admins and parents won't receive password resets or result alerts.",
      fix: "Register a domain, verify it in Resend (add its DNS records), then set the sender to something like Sophie <noreply@yourdomain>.",
    };
  }
  return { status: "ready", detail: `Emails are sent from ${domain}.` };
}

/** Reads Resend's reply to "list my domains" and says whether the sender's domain is verified. */
export function resendDomainVerdict(httpStatus: number, body: unknown, domain: string | null): Verdict {
  if (!domain || domain === "resend.dev") return { status: "unknown", detail: "There's no sender domain of your own to check yet." };
  const reply = (body ?? {}) as { name?: string; data?: { name?: string; status?: string }[] };
  if (httpStatus === 401 || httpStatus === 403 || reply.name === "restricted_api_key") {
    return {
      status: "unknown",
      detail: "The Resend key we use can only send email, so we can't look up your domain.",
      fix: `In the Resend dashboard, open Domains and check ${domain} shows as Verified.`,
    };
  }
  if (httpStatus !== 200 || !Array.isArray(reply.data)) return { status: "unknown", detail: "Resend didn't give a usable answer just now.", fix: "Try again in a moment." };
  const found = reply.data.find((d) => d.name?.toLowerCase() === domain);
  if (!found) return { status: "attention", detail: `${domain} isn't added to your Resend account.`, fix: `Add ${domain} under Domains in Resend and create the DNS records it shows.` };
  if (found.status === "verified") return { status: "ready", detail: `${domain} is verified in Resend.` };
  return { status: "attention", detail: `${domain} is in Resend but its status is "${found.status ?? "unknown"}".`, fix: "Finish adding the DNS records Resend shows, then press Verify there." };
}

// ─── SMS (Termii) ────────────────────────────────────────────────────────────

const APPROVED = new Set(["active", "approved", "unblock", "unblocked"]);
const WAITING = new Set(["pending", "processing", "review", "in_review"]);

/** Reads Termii's list of sender IDs and says whether ours is approved. */
export function termiiSenderVerdict(httpStatus: number, body: unknown, senderId: string): Verdict {
  const reply = (body ?? {}) as { content?: unknown; data?: unknown };
  const list = Array.isArray(reply.content) ? reply.content : Array.isArray(reply.data) ? reply.data : null;
  if (httpStatus !== 200 || !list) return { status: "unknown", detail: "Termii didn't give a usable answer just now.", fix: "Check Sender IDs in the Termii dashboard." };
  if (list.length === 0) {
    return {
      status: "attention",
      detail: `No sender ID is registered on your Termii account, so SMS can't be delivered as "${senderId}".`,
      fix: "In the Termii dashboard open Sender IDs, request the name, and wait for approval (1-3 business days).",
    };
  }
  const rows = list.map((r) => {
    const o = r as { sender_id?: string; senderId?: string; name?: string; status?: string };
    return { id: (o.sender_id ?? o.senderId ?? o.name ?? "").toString(), status: (o.status ?? "").toString().toLowerCase() };
  });
  const ours = rows.find((r) => r.id.toLowerCase() === senderId.toLowerCase());
  if (!ours) return { status: "attention", detail: `"${senderId}" isn't among your Termii sender IDs (${rows.map((r) => r.id).join(", ")}).`, fix: "Request it in Termii, or change the sender ID in Global settings to one that is approved." };
  if (APPROVED.has(ours.status)) return { status: "ready", detail: `Sender ID "${senderId}" is approved.` };
  if (WAITING.has(ours.status)) return { status: "attention", detail: `Sender ID "${senderId}" is still waiting for Termii's approval.`, fix: "Approval usually takes 1-3 business days. SMS starts working when it's approved." };
  return { status: "attention", detail: `Sender ID "${senderId}" has status "${ours.status || "unknown"}" in Termii.`, fix: "Check it in the Termii dashboard." };
}

// ─── Delivery health ─────────────────────────────────────────────────────────

export function deliveryVerdict(channel: "email" | "SMS", sent: number, failed: number): Verdict {
  const total = sent + failed;
  if (total === 0) return { status: "unknown", detail: `No ${channel} messages were sent in the last 30 days, so there's nothing to judge yet.` };
  if (failed === 0) return { status: "ready", detail: `All ${total} ${channel} messages in the last 30 days were delivered.` };
  return {
    status: "attention",
    detail: `${failed} of ${total} ${channel} messages in the last 30 days failed.`,
    fix: channel === "email" ? "Failures before your domain is verified are expected. Check the Notifications page of an affected school for who missed out." : "Failures are expected until the sender ID is approved.",
  };
}

// ─── Freshness ───────────────────────────────────────────────────────────────

export type Freshness = "fresh" | "stale" | "never";

export function freshness(lastAt: Date | null, now: Date, maxHours: number): Freshness {
  if (!lastAt) return "never";
  return now.getTime() - lastAt.getTime() <= maxHours * 3_600_000 ? "fresh" : "stale";
}

export function dailyJobVerdict(f: Freshness, lastAt: Date | null): Verdict {
  if (f === "fresh") return { status: "ready", detail: "The daily subscription job ran in the last 26 hours." };
  if (f === "never") {
    return { status: "attention", detail: "The daily subscription job hasn't run yet.", fix: "It runs every day at 06:00 UTC. If it stays like this after a day, check the cron settings in Vercel and that CRON_SECRET is set." };
  }
  return {
    status: "attention",
    detail: `The daily subscription job last ran on ${lastAt?.toISOString().slice(0, 10)} - more than 26 hours ago.`,
    fix: "Check the cron job in Vercel and the function logs for errors.",
  };
}

// ─── Secrets (presence only) ─────────────────────────────────────────────────

export function secretsVerdict(present: Record<string, boolean>): Verdict {
  const missing = Object.entries(present).filter(([, ok]) => !ok).map(([name]) => name);
  if (missing.length === 0) return { status: "ready", detail: "All the required secrets are set." };
  return { status: "attention", detail: `Missing: ${missing.join(", ")}.`, fix: "Add them in the Vercel project's environment variables and redeploy." };
}

// ─── Roll-up ─────────────────────────────────────────────────────────────────

export function summarise(checks: Pick<Check, "status">[]) {
  const ready = checks.filter((c) => c.status === "ready").length;
  const attention = checks.filter((c) => c.status === "attention").length;
  return { ready, attention, unknown: checks.length - ready - attention, total: checks.length };
}
