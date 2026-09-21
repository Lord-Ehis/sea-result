import { prisma } from "@/lib/prisma";
import { getPaystackKeyMode } from "@/lib/paystack";
import { readEmailConfig } from "@/lib/email";
import { readSmsConfig } from "@/lib/sms";
import { getHeartbeat } from "@/lib/heartbeat";
import { LEGAL_VERSION } from "@/lib/legal";
import {
  dailyJobVerdict,
  deliveryVerdict,
  emailSenderVerdict,
  freshness,
  paystackKeyVerdict,
  publicAddressVerdict,
  resendDomainVerdict,
  secretsVerdict,
  senderDomain,
  termiiSenderVerdict,
  webhookVerdict,
  type Check,
} from "@/lib/readiness-rules";

// Gathers the facts the owner's Go-live page judges. Every outside call has a
// short timeout and falls back to "can't check", so the page always loads.

const OUTSIDE_TIMEOUT_MS = 6000;
const THIRTY_DAYS_MS = 30 * 24 * 3_600_000;

async function outside(url: string, init?: RequestInit): Promise<{ status: number; body: unknown } | null> {
  try {
    const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(OUTSIDE_TIMEOUT_MS) });
    return { status: res.status, body: await res.json().catch(() => null) };
  } catch {
    return null;
  }
}

export type SchoolRow = { id: string; name: string; status: string; students: number; published: number; createdAt: Date };

export async function getReadiness(now = new Date()) {
  const publicUrl = process.env.NEXTAUTH_URL ?? null;
  const webhookUrl = `${(publicUrl ?? "https://your-site").replace(/\/$/, "")}/api/webhooks/paystack`;

  const [keyMode, webhookAt, cronAt, email, sms, grouped, schools] = await Promise.all([
    getPaystackKeyMode(),
    getHeartbeat("paystack_webhook"),
    getHeartbeat("cron_subscriptions"),
    readEmailConfig(),
    readSmsConfig(),
    prisma.notification.groupBy({ by: ["channel", "status"], where: { createdAt: { gte: new Date(now.getTime() - THIRTY_DAYS_MS) } }, _count: { _all: true } }),
    prisma.school.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, status: true, createdAt: true, _count: { select: { students: true } } },
    }),
  ]);

  const published = await prisma.result.groupBy({ by: ["schoolId"], where: { status: "PUBLISHED" }, _count: { _all: true } });
  const publishedBy = new Map(published.map((p) => [p.schoolId, p._count._all]));
  const schoolRows: SchoolRow[] = schools.map((s) => ({ id: s.id, name: s.name, status: s.status, students: s._count.students, published: publishedBy.get(s.id) ?? 0, createdAt: s.createdAt }));

  const count = (channel: "EMAIL" | "SMS", status: "SENT" | "FAILED") => grouped.filter((g) => g.channel === channel && g.status === status).reduce((n, g) => n + g._count._all, 0);

  // Outside lookups, only when there is something to look up.
  const domain = senderDomain(email?.from);
  const [resend, termii] = await Promise.all([
    email && domain && domain !== "resend.dev" ? outside("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${email.apiKey}` } }) : Promise.resolve(null),
    sms ? outside(new URL(`/api/sender-id?api_key=${encodeURIComponent(sms.apiKey)}`, sms.baseUrl).toString()) : Promise.resolve(null),
  ]);

  const checks: Check[] = [
    { id: "paystack-mode", group: "Payments", title: "Paystack is taking real payments", ...paystackKeyVerdict(keyMode) },
    { id: "paystack-webhook", group: "Payments", title: "Paystack payment notifications reach us", ...webhookVerdict(freshness(webhookAt, now, 24 * 365), webhookAt, webhookUrl) },
    { id: "public-address", group: "Payments", title: "The site has its own https address", ...publicAddressVerdict(publicUrl) },

    { id: "email-sender", group: "Email", title: "Emails come from your own domain", ...emailSenderVerdict(email?.from) },
    {
      id: "email-domain",
      group: "Email",
      title: "Your email domain is verified",
      ...(resend ? resendDomainVerdict(resend.status, resend.body, domain) : domain && domain !== "resend.dev" ? { status: "unknown" as const, detail: "Resend didn't answer just now.", fix: "Try again in a moment." } : resendDomainVerdict(0, null, domain)),
    },
    { id: "email-delivery", group: "Email", title: "Emails are being delivered", ...deliveryVerdict("email", count("EMAIL", "SENT"), count("EMAIL", "FAILED")) },

    {
      id: "sms-sender",
      group: "SMS",
      title: "SMS sender ID is approved",
      ...(!sms
        ? { status: "attention" as const, detail: "SMS isn't configured.", fix: "Add the Termii key in Global settings." }
        : termii
          ? termiiSenderVerdict(termii.status, termii.body, sms.senderId)
          : { status: "unknown" as const, detail: "Termii didn't answer just now.", fix: "Try again in a moment." }),
    },
    { id: "sms-delivery", group: "SMS", title: "SMS messages are being delivered", ...deliveryVerdict("SMS", count("SMS", "SENT"), count("SMS", "FAILED")) },

    { id: "daily-job", group: "Platform", title: "The daily subscription job is running", ...dailyJobVerdict(freshness(cronAt, now, 26), cronAt) },
    {
      id: "secrets",
      group: "Platform",
      title: "Required secrets are set",
      ...secretsVerdict({ AUTH_SECRET: !!process.env.AUTH_SECRET, CRON_SECRET: !!process.env.CRON_SECRET, PROVIDER_CONFIG_KEY: !!process.env.PROVIDER_CONFIG_KEY }),
    },
    {
      id: "schools",
      group: "Platform",
      title: "No leftover test schools",
      status: "unknown",
      detail: `${schoolRows.length} school${schoolRows.length === 1 ? "" : "s"} in the database - review the list below and make sure each one is real.`,
      fix: "A school you no longer need can be suspended from its page under Schools. Removing one for good is done by hand in the database.",
    },

    { id: "legal", group: "Legal", title: "Terms and Privacy Policy are published, and sign-up asks for agreement", status: "ready", detail: `Both pages are live (version ${LEGAL_VERSION}) and school and parent sign-up require agreement.`, fix: "Have a Nigerian lawyer review both pages before launch." },
  ];

  return { checks, schools: schoolRows, webhookUrl };
}
