import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { prisma } from "@/lib/prisma";
import { getHeartbeat } from "@/lib/heartbeat";
import {
  FAILED_MESSAGE_DAYS,
  FAILED_PAYMENT_DAYS,
  STUCK_PAYMENT_MAX_DAYS,
  STUCK_PAYMENT_MINUTES,
  cronLooksStale,
  onboardingGaps,
  relativeDays,
  subscriptionAttention,
  type SubscriptionAttentionItem,
} from "@/lib/owner-attention";

const naira = (n: number) => `₦${n.toLocaleString()}`;
const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function ago(date: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

type Tone = "success" | "warning" | "danger" | "neutral";

function Section({ id, title, intro, count, tone, children }: { id: string; title: string; intro: string; count: number; tone: Tone; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-5 scroll-mt-4 overflow-hidden rounded-md border border-border bg-bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="m-0 text-heading font-medium text-text-primary">{title}</h2>
          <p className="mt-1 text-caption text-text-muted">{intro}</p>
        </div>
        {count > 0 ? <StatusPill label={`${count} to look at`} tone={tone} /> : <StatusPill label="All clear" tone="success" />}
      </div>
      {children}
    </section>
  );
}

function Row({ schoolId, name, detail, pill }: { schoolId?: string; name: string; detail: React.ReactNode; pill?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f2f3] px-5 py-3.5 last:border-0">
      <div className="min-w-0">
        {schoolId ? (
          <Link href={`/owner/schools/${schoolId}`} className="text-body font-medium text-primary hover:underline">
            {name}
          </Link>
        ) : (
          <strong className="text-body font-medium text-text-primary">{name}</strong>
        )}
        <div className="text-caption text-text-muted">{detail}</div>
      </div>
      {pill}
    </div>
  );
}

const Nothing = ({ text }: { text: string }) => <p className="m-0 px-5 py-5 text-caption text-text-muted">{text}</p>;
const GroupLabel = ({ text }: { text: string }) => <div className="bg-[#fafbfb] px-5 py-2 text-[10px] font-medium uppercase tracking-wide text-text-muted">{text}</div>;

export default async function OwnerOverviewPage() {
  const now = new Date();
  const failedSince = new Date(now.getTime() - FAILED_MESSAGE_DAYS * 86_400_000);
  const paymentFailedSince = new Date(now.getTime() - FAILED_PAYMENT_DAYS * 86_400_000);
  const stuckBefore = new Date(now.getTime() - STUCK_PAYMENT_MINUTES * 60_000);
  const stuckAfter = new Date(now.getTime() - STUCK_PAYMENT_MAX_DAYS * 86_400_000);

  const [schools, teacherCounts, deletionRequests, failedMessages, stuckPayments, failedPayments, cronAt, webhookAt] = await Promise.all([
    prisma.school.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        subscriptions: { select: { status: true, startDate: true, endDate: true } },
        _count: { select: { students: { where: { isActive: true } }, resultTemplates: true } },
      },
    }),
    prisma.user.groupBy({ by: ["schoolId"], where: { role: "TEACHER", isActive: true, schoolId: { not: null } }, _count: { _all: true } }),
    prisma.deletionRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { requestedAt: "asc" },
      include: { school: { select: { id: true, name: true } }, requestedBy: { select: { name: true } } },
    }),
    prisma.notification.groupBy({ by: ["schoolId", "channel"], where: { status: "FAILED", createdAt: { gte: failedSince } }, _count: { _all: true } }),
    prisma.payment.findMany({
      where: { status: "PENDING", createdAt: { lt: stuckBefore, gte: stuckAfter } },
      orderBy: { createdAt: "asc" },
      take: 20,
      include: { school: { select: { id: true, name: true } } },
    }),
    prisma.payment.findMany({
      where: { status: "FAILED", createdAt: { gte: paymentFailedSince } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { school: { select: { id: true, name: true } } },
    }),
    getHeartbeat("cron_subscriptions"),
    getHeartbeat("paystack_webhook"),
  ]);

  const schoolName = new Map(schools.map((s) => [s.id, s.name]));
  const teachersBySchool = new Map(teacherCounts.map((t) => [t.schoolId, t._count._all]));

  const subs = subscriptionAttention(
    schools.map((s) => ({ id: s.id, name: s.name, status: s.status, subscriptions: s.subscriptions })),
    now,
  );
  const subscriptionCount = subs.lapsed.length + subs.grace.length + subs.expiringSoon.length;

  const stalled = schools
    .map((s) => ({
      school: s,
      gaps: onboardingGaps({ status: s.status, createdAt: s.createdAt, students: s._count.students, teachers: teachersBySchool.get(s.id) ?? 0, templates: s._count.resultTemplates }, now),
    }))
    .filter((x): x is { school: (typeof schools)[number]; gaps: string[] } => x.gaps !== null)
    .sort((a, b) => a.school.createdAt.getTime() - b.school.createdAt.getTime());

  const failedBySchool = new Map<string, { sms: number; email: number }>();
  for (const row of failedMessages) {
    const entry = failedBySchool.get(row.schoolId) ?? { sms: 0, email: 0 };
    if (row.channel === "SMS") entry.sms += row._count._all;
    else entry.email += row._count._all;
    failedBySchool.set(row.schoolId, entry);
  }
  const failedList = [...failedBySchool.entries()].map(([schoolId, c]) => ({ schoolId, ...c, total: c.sms + c.email })).sort((a, b) => b.total - a.total);
  const failedTotal = failedList.reduce((sum, f) => sum + f.total, 0);

  const paymentCount = stuckPayments.length + failedPayments.length;
  const cronStale = cronLooksStale(cronAt, now);
  const systemCount = cronStale ? 1 : 0;

  const tiles: { label: string; count: number; href: string; tone: Tone; note: string }[] = [
    { label: "Subscriptions", count: subscriptionCount, href: "#subscriptions", tone: subs.lapsed.length > 0 ? "danger" : "warning", note: subs.lapsed.length > 0 ? `${subs.lapsed.length} locked out` : "ending soon" },
    { label: "Deletion requests", count: deletionRequests.length, href: "#deletions", tone: "warning", note: "waiting for you" },
    { label: "Failed messages", count: failedTotal, href: "#messages", tone: "warning", note: `last ${FAILED_MESSAGE_DAYS} days` },
    { label: "Payments", count: paymentCount, href: "#payments", tone: "warning", note: "stuck or failed" },
    { label: "Setup stalled", count: stalled.length, href: "#onboarding", tone: "neutral", note: "schools not set up" },
    { label: "System", count: systemCount, href: "#system", tone: "danger", note: "background jobs" },
  ];
  const allClear = tiles.every((t) => t.count === 0);

  return (
    <>
      <PageHeader
        eyebrow="Platform overview"
        title="Needs attention"
        intro="What needs you today, across every school. Reload the page to check again."
      />

      {allClear ? (
        <div className="mb-6 flex items-center gap-3 rounded-md border border-success/30 bg-success-bg px-5 py-4 text-body text-success">
          <CheckCircle2 size={20} strokeWidth={1.8} />
          Everything looks fine right now. No lapsed subscriptions, requests, failed messages, stuck payments or stalled schools.
        </div>
      ) : null}

      <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Summary">
        {tiles.map((t) => (
          <a key={t.label} href={t.href} className="flex min-h-[104px] flex-col justify-between rounded-md border border-border bg-bg-card p-4 hover:border-primary/40">
            <span className="text-caption leading-snug text-text-secondary">{t.label}</span>
            <div>
              <div className="text-title font-medium tracking-tight text-text-primary">{t.count.toLocaleString()}</div>
              <div className="mt-1">{t.count > 0 ? <StatusPill label={t.note} tone={t.tone} /> : <StatusPill label="All clear" tone="success" />}</div>
            </div>
          </a>
        ))}
      </div>

      <Section id="subscriptions" title="Subscriptions" intro="Schools that are locked out, in their grace period, or about to run out. Suspended schools are left out." count={subscriptionCount} tone={subs.lapsed.length > 0 ? "danger" : "warning"}>
        {subscriptionCount === 0 ? (
          <Nothing text="Every school's subscription is in good standing." />
        ) : (
          <>
            {([
              ["Locked out", subs.lapsed, "danger"],
              ["In grace period", subs.grace, "warning"],
              ["Ending soon", subs.expiringSoon, "neutral"],
            ] as [string, SubscriptionAttentionItem[], Tone][]).map(([label, items, tone]) =>
              items.length === 0 ? null : (
                <div key={label}>
                  <GroupLabel text={label} />
                  {items.map((s) => (
                    <Row
                      key={s.schoolId}
                      schoolId={s.schoolId}
                      name={s.name}
                      detail={s.coverageEndsAt ? `${s.daysLeft !== null && s.daysLeft >= 0 ? "Ends" : "Ended"} ${fmtDate(s.coverageEndsAt)}` : "Has never had a subscription"}
                      pill={<StatusPill label={s.coverageEndsAt ? relativeDays(s.daysLeft) : "No subscription"} tone={tone} />}
                    />
                  ))}
                </div>
              ),
            )}
          </>
        )}
      </Section>

      <Section id="deletions" title="Deletion requests" intro="Schools that asked for their data to be removed. Approving or declining is up to you." count={deletionRequests.length} tone="warning">
        {deletionRequests.length === 0 ? (
          <Nothing text="No deletion requests are waiting." />
        ) : (
          deletionRequests.map((r) => (
            <Row
              key={r.id}
              schoolId={r.school.id}
              name={r.school.name}
              detail={`Requested by ${r.requestedBy.name} on ${fmtDate(r.requestedAt)} — "${r.reason.length > 110 ? `${r.reason.slice(0, 110)}…` : r.reason}"`}
              pill={
                <Link href={`/owner/schools/${r.school.id}`} className="inline-flex h-8 items-center rounded-md border border-[#cbdde9] bg-bg-card px-3 text-caption font-medium text-primary hover:bg-primary-bg">
                  Review
                </Link>
              }
            />
          ))
        )}
      </Section>

      <Section id="messages" title="Failed messages" intro={`SMS and emails that could not be sent in the last ${FAILED_MESSAGE_DAYS} days, by school. School admins can retry result notifications from their Notifications page.`} count={failedTotal} tone="warning">
        {failedList.length === 0 ? (
          <Nothing text="No failed messages." />
        ) : (
          <>
            {failedList.map((f) => (
              <Row
                key={f.schoolId}
                schoolId={f.schoolId}
                name={schoolName.get(f.schoolId) ?? "Unknown school"}
                detail={[f.sms > 0 ? `${f.sms} SMS` : null, f.email > 0 ? `${f.email} email${f.email === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ") + " failed"}
                pill={<StatusPill label={`${f.total} failed`} tone="warning" />}
              />
            ))}
            <p className="m-0 border-t border-border bg-[#fafbfb] px-5 py-3 text-caption text-text-muted">
              Many failures across several schools usually point at a provider setting (the SMS sender ID or the email sending domain). Check{" "}
              <Link href="/owner/settings" className="text-primary hover:underline">
                Global settings
              </Link>
              .
            </p>
          </>
        )}
      </Section>

      <Section id="payments" title="Payments" intro={`Payments started over ${STUCK_PAYMENT_MINUTES} minutes ago (within the last ${STUCK_PAYMENT_MAX_DAYS} days) and never completed, and payments that failed in the last ${FAILED_PAYMENT_DAYS} days.`} count={paymentCount} tone="warning">
        {paymentCount === 0 ? (
          <Nothing text="No stuck or failed payments." />
        ) : (
          <>
            {stuckPayments.length > 0 && <GroupLabel text="Started but not completed" />}
            {stuckPayments.map((p) => (
              <Row key={p.id} schoolId={p.school.id} name={p.school.name} detail={`${naira(p.amount.toNumber())} · started ${ago(p.createdAt, now)} · ${p.paystackReference}`} pill={<StatusPill label="Pending" tone="warning" />} />
            ))}
            {failedPayments.length > 0 && <GroupLabel text="Failed" />}
            {failedPayments.map((p) => (
              <Row key={p.id} schoolId={p.school.id} name={p.school.name} detail={`${naira(p.amount.toNumber())} · ${ago(p.createdAt, now)} · ${p.paystackReference}`} pill={<StatusPill label="Failed" tone="danger" />} />
            ))}
            <p className="m-0 border-t border-border bg-[#fafbfb] px-5 py-3 text-caption text-text-muted">
              A payment that stays pending after the person paid usually means our Paystack webhook did not reach us. Last webhook received: {webhookAt ? fmtDate(webhookAt) : "never"}.
            </p>
          </>
        )}
      </Section>

      <Section id="onboarding" title="Setup stalled" intro={`Schools more than a few days old that still have no students, teachers or result template. A nudge or a call may help.`} count={stalled.length} tone="neutral">
        {stalled.length === 0 ? (
          <Nothing text="Every school that has had time to set up has done so." />
        ) : (
          stalled.map(({ school, gaps }) => (
            <Row
              key={school.id}
              schoolId={school.id}
              name={school.name}
              detail={`Signed up ${fmtDate(school.createdAt)}`}
              pill={
                <div className="flex flex-wrap justify-end gap-1.5">
                  {gaps.map((g) => (
                    <StatusPill key={g} label={g} tone="neutral" />
                  ))}
                </div>
              }
            />
          ))
        )}
        <p className="m-0 border-t border-border bg-[#fafbfb] px-5 py-3 text-caption text-text-muted">
          For how every school is using the platform, including schools that have gone quiet, see{" "}
          <Link href="/owner/adoption" className="text-primary hover:underline">
            Adoption
          </Link>
          .
        </p>
      </Section>

      <Section id="system" title="System" intro="Background jobs the platform relies on. See Go-live for the full checklist." count={systemCount} tone="danger">
        <Row
          name="Daily subscription job"
          detail={cronAt ? `Last ran ${ago(cronAt, now)} (${fmtDate(cronAt)})` : "Has never run"}
          pill={<StatusPill label={cronStale ? "Not running?" : "OK"} tone={cronStale ? "danger" : "success"} />}
        />
        <Row
          name="Paystack webhook"
          detail={webhookAt ? `Last received ${ago(webhookAt, now)} (${fmtDate(webhookAt)})` : "Nothing received yet"}
          pill={<StatusPill label={webhookAt ? "Seen" : "Not seen yet"} tone={webhookAt ? "success" : "neutral"} />}
        />
      </Section>
    </>
  );
}
