import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAndSendNotification } from "@/lib/notifications";
import { dueMilestones, resolveSchoolAccess, type ReminderMilestone } from "@/lib/school-access";
import { touchHeartbeat } from "@/lib/heartbeat";

// Runs once a day (see vercel.json). Vercel calls it with
// `Authorization: Bearer $CRON_SECRET`; anything else is refused, and it never
// runs at all if the secret isn't configured.
//
// It (1) records subscriptions that have run out as EXPIRED and (2) emails each
// school's main administrators as the end approaches, when it arrives, and when
// the grace period is over. Each email has a fixed key per school + end date +
// milestone + person, so running the job twice — or every day — never repeats
// one. Enforcement doesn't depend on this job: access is worked out from the
// dates on every request.

const dateLabel = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function message(school: string, milestone: ReminderMilestone, ends: Date, graceEnds: Date, link: string) {
  switch (milestone) {
    case "T-14":
    case "T-7":
    case "T-1": {
      const days = milestone === "T-14" ? "14 days" : milestone === "T-7" ? "7 days" : "1 day";
      return {
        subject: `${school}: your subscription ends in ${days}`,
        text: `Your Sophie Educational Assistant subscription for ${school} ends on ${dateLabel(ends)}.\n\nRenew before then so your teachers can keep entering and publishing results without interruption:\n${link}`,
      };
    }
    case "ENDED":
      return {
        subject: `${school}: your subscription has ended`,
        text: `Your Sophie Educational Assistant subscription for ${school} ended on ${dateLabel(ends)}.\n\nEverything keeps working until ${dateLabel(graceEnds)}. After that your staff will be locked out until you renew:\n${link}`,
      };
    case "LOCKED":
      return {
        subject: `${school}: access is now paused`,
        text: `The grace period for ${school} ended on ${dateLabel(graceEnds)}, so your teachers and staff can no longer sign in. Parents can still see results already published.\n\nRenew to restore access straight away:\n${link}`,
      };
  }
}

export async function GET(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const summary = { expired: 0, schools: 0, remindersCreated: 0 };

  const expired = await prisma.subscription.updateMany({ where: { status: "ACTIVE", endDate: { lt: now } }, data: { status: "EXPIRED" } });
  summary.expired = expired.count;

  const schools = await prisma.school.findMany({
    where: { status: "ACTIVE", subscriptions: { some: {} } },
    select: {
      id: true,
      name: true,
      status: true,
      subscriptions: { select: { status: true, startDate: true, endDate: true } },
      users: { where: { role: "SCHOOL_ADMIN", campusScoped: false, isActive: true }, select: { id: true, email: true } },
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  for (const school of schools) {
    summary.schools++;
    const access = resolveSchoolAccess({ status: school.status, subscriptions: school.subscriptions, now });
    const milestones = dueMilestones(access, now);
    if (milestones.length === 0 || !access.coverageEndsAt || !access.graceEndsAt) continue;

    for (const milestone of milestones) {
      const { subject, text } = message(school.name, milestone, access.coverageEndsAt, access.graceEndsAt, `${baseUrl}/admin/billing`);
      for (const admin of school.users) {
        const before = await prisma.notification.count({ where: { userId: admin.id, event: "SUBSCRIPTION_REMINDER" } });
        await createAndSendNotification({
          schoolId: school.id,
          userId: admin.id,
          channel: "EMAIL",
          event: "SUBSCRIPTION_REMINDER",
          recipient: admin.email,
          subject,
          message: text,
          dedupeKey: `SUB:${school.id}:${access.coverageEndsAt.toISOString().slice(0, 10)}:${milestone}:${admin.id}`,
        });
        const after = await prisma.notification.count({ where: { userId: admin.id, event: "SUBSCRIPTION_REMINDER" } });
        summary.remindersCreated += after - before;
      }
    }
  }

  await touchHeartbeat("cron_subscriptions");
  return NextResponse.json({ ok: true, ...summary });
}
