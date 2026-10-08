import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { hit } from "@/lib/rate-limit";
import { ALERT_EMAILS_PER_HOUR, ALERT_EVERY_MINUTES, alertEmail, describeError } from "@/lib/error-rules";

// Records a server error and, the first time (and then at most hourly), emails
// the platform owner. Called from instrumentation.ts for every error Next.js
// catches while rendering a page, running a route or running a form action.
// It must never make things worse, so it never throws and gives email a few
// seconds at most.

const EMAIL_TIMEOUT_MS = 5000;

export async function captureServerError(err: unknown, context: { routePath?: unknown; routeType?: unknown }, now = new Date()): Promise<void> {
  try {
    const error = describeError(err, context);
    if (!error) return;

    const existing = await prisma.errorEvent.findUnique({ where: { fingerprint: error.fingerprint }, select: { resolvedAt: true } });
    const row = await prisma.errorEvent.upsert({
      where: { fingerprint: error.fingerprint },
      create: { fingerprint: error.fingerprint, name: error.name, message: error.message, stack: error.stack, route: error.route, routeType: error.routeType, firstSeenAt: now, lastSeenAt: now },
      // Back after being marked fixed: reopen it and make it alert again.
      update: { count: { increment: 1 }, lastSeenAt: now, message: error.message, stack: error.stack, resolvedAt: null, ...(existing?.resolvedAt ? { lastAlertedAt: null } : {}) },
      select: { id: true, count: true },
    });

    // Claim the alert: of several requests failing at once, only one gets to send it.
    const cutoff = new Date(now.getTime() - ALERT_EVERY_MINUTES * 60_000);
    const claimed = await prisma.errorEvent.updateMany({
      where: { id: row.id, OR: [{ lastAlertedAt: null }, { lastAlertedAt: { lt: cutoff } }] },
      data: { lastAlertedAt: now },
    });
    if (claimed.count !== 1) return;
    if (!(await hit("error-alert-emails", ALERT_EMAILS_PER_HOUR, 3600)).allowed) return;

    const owners = await prisma.user.findMany({ where: { role: "PLATFORM_OWNER", isActive: true }, select: { email: true } });
    const message = alertEmail(error, row.count, process.env.NEXTAUTH_URL ?? "http://localhost:3000");
    await Promise.race([
      Promise.allSettled(owners.map((o) => sendEmail({ to: o.email, ...message }))),
      new Promise((resolve) => setTimeout(resolve, EMAIL_TIMEOUT_MS)),
    ]);
  } catch (captureFailure) {
    console.error("could not record a server error", captureFailure);
  }
}
